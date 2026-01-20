"""
Onboarding Orchestration Service

Manages the complete tenant onboarding flow:
- Template selection and configuration
- Module dependency resolution and ordering
- Step execution and state tracking
- Error handling and recovery
"""

from typing import Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.models.iam import Tenant, User
from app.models.onboarding import (
    TenantOnboarding,
    OnboardingTemplate,
    OnboardingStep,
    ModuleDefinition,
    ModuleDependency,
    Contact
)
from app.models.erp_modules import TenantERPConfig, TenantERPModule
from app.utils.codes import generate_entity_code
from datetime import datetime
import uuid
from collections import deque, defaultdict

# Hardcoded system templates (could be extended to database-driven)
SYSTEM_TEMPLATES = {
    "STARTUP": {
        "name": "Startup",
        "description": "Essential modules for a growing business",
        "modules": ["accounting", "inventory", "pos"],
        "module_configurations": {
            "accounting": {"company_currency": "KES"},
            "inventory": {"default_warehouse": "Main Store"},
            "pos": {"enable_loyalty": False}
        },
        "global_configuration": {
            "include_demo_data": False,
            "enable_mobile_app": False
        }
    },
    "SME": {
        "name": "Small-Medium Enterprise",
        "description": "Complete suite for SME operations",
        "modules": ["accounting", "inventory", "pos", "crm", "purchasing"],
        "module_configurations": {
            "accounting": {"company_currency": "KES", "enable_multi_currency": False},
            "inventory": {"enable_batch_tracking": True, "enable_serial_numbers": False},
            "crm": {"enable_email_sync": True},
            "purchasing": {"auto_create_po": False}
        },
        "global_configuration": {
            "include_demo_data": False,
            "enable_two_factor_auth": True,
            "audit_logging": True
        }
    },
    "ENTERPRISE": {
        "name": "Enterprise",
        "description": "Full-featured ERP for large organizations",
        "modules": ["accounting", "inventory", "pos", "crm", "manufacturing", "hr", "projects", "purchasing"],
        "module_configurations": {
            "accounting": {"company_currency": "KES", "enable_multi_currency": True, "enable_advanced_reporting": True},
            "inventory": {"enable_batch_tracking": True, "enable_serial_numbers": True, "enable_warehouse_automation": True},
            "manufacturing": {"enable_work_center_planning": True},
            "hr": {"enable_payroll": True, "enable_attendance": True},
            "projects": {"enable_timesheet_sync": True}
        },
        "global_configuration": {
            "include_demo_data": False,
            "enable_two_factor_auth": True,
            "audit_logging": True,
            "enable_advanced_analytics": True
        }
    }
}

# Module dependency graph (hard dependencies only)
MODULE_DEPENDENCIES = {
    "pos": ["inventory", "accounting"],  # POS requires inventory and accounting
    "manufacturing": ["inventory", "accounting"],  # Manufacturing requires inventory and accounting
    "crm": ["accounting"],  # CRM benefits from accounting integration
    "purchasing": ["inventory", "accounting"],  # Purchasing requires both
    "hr": ["accounting"],  # HR needs accounting for payroll
    "projects": ["hr"],  # Projects can use HR for resource allocation
}


class OnboardingOrchestrator:
    """
    Orchestrates tenant onboarding with:
    - Template-based module selection
    - Dependency resolution via topological sort
    - Step execution with error recovery
    - JSONB configuration management
    """

    def __init__(self, db: Session):
        self.db = db

    def _get_engine_for_workspace_type(self, workspace_type: Optional[str], tenant: Tenant) -> str:
        """
        Determine engine based on workspace type:
        - SACCO → CBS (Fineract)
        - ENTERPRISE → ERPNext (priority) or Odoo
        - Others → Odoo (default)
        """
        if workspace_type == 'SACCO':
            return 'cbs'  # Fineract/CBS
        elif workspace_type == 'ENTERPRISE':
            # Priority: ERPNext, fallback to Odoo
            return 'erpnext'  # Can be configured to prefer ERPNext
        else:
            # Default to existing engine or Odoo
            return tenant.engine or 'odoo'
    
    def _get_template_for_workspace_type(self, workspace_type: Optional[str], template_code: Optional[str]) -> str:
        """
        Auto-select template based on workspace type if not provided.
        """
        if template_code:
            return template_code
        
        # Map workspace types to templates
        mapping = {
            'SACCO': 'ENTERPRISE',  # SACCO needs full features
            'ENTERPRISE': 'ENTERPRISE',
            'SME': 'SME',
            'STARTUP': 'STARTUP'
        }
        
        return mapping.get(workspace_type, 'STARTUP')
    
    def initiate_onboarding(
        self,
        tenant_id: str,
        workspace_type: Optional[str] = None,
        template_code: Optional[str] = None,
        custom_config: Optional[Dict] = None,
        initiated_by_user_id: Optional[str] = None
    ) -> TenantOnboarding:
        """
        Start an onboarding flow for a tenant.
        
        Args:
            tenant_id: Tenant UUID
            workspace_type: 'SACCO', 'ENTERPRISE', 'SME', 'STARTUP' - determines engine
            template_code: 'STARTUP', 'SME', 'ENTERPRISE', or custom code (auto-selected if not provided)
            custom_config: Override template configuration
            initiated_by_user_id: User initiating onboarding
            
        Returns:
            TenantOnboarding object in DRAFT status
        """
        tenant = self.db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            raise ValueError(f"Tenant {tenant_id} not found")

        # Check if already onboarding (allow resuming from PAUSED)
        existing = self.db.query(TenantOnboarding).filter(
            TenantOnboarding.tenant_id == tenant_id,
            TenantOnboarding.status.in_(["DRAFT", "IN_PROGRESS"])
        ).first()
        
        if existing:
            # If existing is DRAFT or IN_PROGRESS, can't start new one
            raise ValueError(f"Tenant already has active onboarding: {existing.status}")
        
        # Check for PAUSED onboarding that can be resumed
        paused_onboarding = self.db.query(TenantOnboarding).filter(
            TenantOnboarding.tenant_id == tenant_id,
            TenantOnboarding.status == 'PAUSED'
        ).first()
        
        if paused_onboarding:
            # Return existing paused onboarding for resume
            return paused_onboarding

        # Determine template if not provided
        final_template_code = self._get_template_for_workspace_type(workspace_type, template_code)
        
        # Determine and set engine based on workspace type
        engine = self._get_engine_for_workspace_type(workspace_type, tenant)
        if engine != tenant.engine:
            tenant.engine = engine
            self.db.flush()
        
        # Load template
        template = self._load_template(final_template_code)
        
        # Merge configurations
        merged_config = self._merge_configurations(template, custom_config)
        
        # Add workspace_type and engine to configuration
        if not merged_config:
            merged_config = {}
        if 'metadata' not in merged_config:
            merged_config['metadata'] = {}
        merged_config['metadata']['workspace_type'] = workspace_type
        merged_config['metadata']['engine'] = engine
        
        # Create onboarding record
        onboarding = TenantOnboarding(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            workspace_type=workspace_type,
            template=final_template_code,
            status='DRAFT',
            configuration=merged_config,
            started_by=initiated_by_user_id
        )
        
        self.db.add(onboarding)
        self.db.flush()
        
        # Create step records based on resolved dependencies
        self._create_onboarding_steps(onboarding, template, merged_config)
        
        self.db.commit()
        self.db.refresh(onboarding)
        
        return onboarding

    def start_onboarding(self, tenant_id: str) -> TenantOnboarding:
        """Transition onboarding from DRAFT or PAUSED to IN_PROGRESS."""
        onboarding = self.db.query(TenantOnboarding).filter(
            TenantOnboarding.tenant_id == tenant_id,
            TenantOnboarding.status.in_(["DRAFT", "PAUSED"])
        ).first()
        
        if not onboarding:
            raise ValueError(f"No draft or paused onboarding found for tenant {tenant_id}")
        
        if onboarding.status == "PAUSED":
            # Resume paused onboarding
            onboarding.status = "IN_PROGRESS"
        elif onboarding.status == "DRAFT":
            # Start new onboarding
            onboarding.status = "IN_PROGRESS"
            onboarding.started_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(onboarding)
        
        return onboarding

    def execute_next_step(self, tenant_id: str) -> Optional[OnboardingStep]:
        """
        Execute the next pending step.
        Can resume from PAUSED status.
        
        Returns:
            Completed step or None if all steps completed
        """
        onboarding = self.db.query(TenantOnboarding).filter(
            TenantOnboarding.tenant_id == tenant_id,
            TenantOnboarding.status.in_(["IN_PROGRESS", "PAUSED"])
        ).first()
        
        if not onboarding:
            raise ValueError(f"No active or paused onboarding for tenant {tenant_id}")
        
        # Auto-resume if paused
        if onboarding.status == "PAUSED":
            onboarding.status = "IN_PROGRESS"
            self.db.commit()
        
        if onboarding.status == "COMPLETED":
            return None
        
        # Find next pending step
        next_step = self.db.query(OnboardingStep).filter(
            OnboardingStep.onboarding_id == onboarding.id,
            OnboardingStep.status == "PENDING"
        ).order_by(OnboardingStep.order).first()
        
        if not next_step:
            # All steps completed
            onboarding.status = "COMPLETED"
            onboarding.completed_at = datetime.utcnow()
            self.db.commit()
            return None
        
        # Execute step
        return self._execute_step(onboarding, next_step)

    def skip_step(self, tenant_id: str, step_code: str) -> OnboardingStep:
        """Skip a step and mark as skipped."""
        onboarding = self._get_active_onboarding(tenant_id)
        
        step = self.db.query(OnboardingStep).filter(
            OnboardingStep.onboarding_id == onboarding.id,
            OnboardingStep.step_code == step_code
        ).first()
        
        if not step:
            raise ValueError(f"Step {step_code} not found")
        
        if step.status != "PENDING":
            raise ValueError(f"Cannot skip step in {step.status} status")
        
        step.status = "SKIPPED"
        self.db.commit()
        self.db.refresh(step)
        
        return step
    
    def pause_onboarding(self, tenant_id: str) -> TenantOnboarding:
        """Pause an ongoing onboarding process so user can resume later."""
        onboarding = self.db.query(TenantOnboarding).filter(
            TenantOnboarding.tenant_id == tenant_id,
            TenantOnboarding.status.in_(["DRAFT", "IN_PROGRESS"])
        ).first()
        
        if not onboarding:
            raise ValueError(f"No active onboarding found for tenant {tenant_id}")
        
        onboarding.status = "PAUSED"
        self.db.commit()
        self.db.refresh(onboarding)
        
        return onboarding
    
    def resume_onboarding(self, tenant_id: str) -> TenantOnboarding:
        """Resume a paused onboarding process."""
        onboarding = self.db.query(TenantOnboarding).filter(
            TenantOnboarding.tenant_id == tenant_id,
            TenantOnboarding.status == "PAUSED"
        ).first()
        
        if not onboarding:
            raise ValueError(f"No paused onboarding found for tenant {tenant_id}")
        
        onboarding.status = "IN_PROGRESS"
        if not onboarding.started_at:
            onboarding.started_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(onboarding)
        
        return onboarding

    def get_onboarding_status(self, tenant_id: str) -> Dict:
        """Get complete onboarding status and progress."""
        onboarding = self._get_active_onboarding(tenant_id, required=False)
        
        if not onboarding:
            return {"status": "NOT_STARTED", "progress": 0}
        
        steps = self.db.query(OnboardingStep).filter(
            OnboardingStep.onboarding_id == onboarding.id
        ).order_by(OnboardingStep.order).all()
        
        total = len(steps)
        completed = len([s for s in steps if s.status in ["COMPLETED", "SKIPPED"]])
        progress = (completed / total * 100) if total > 0 else 0
        
        return {
            "status": onboarding.status,
            "workspace_type": onboarding.workspace_type,
            "template": onboarding.template,
            "progress": progress,
            "current_step": onboarding.current_step,
            "total_steps": total,
            "completed_steps": completed,
            "steps": [
                {
                    "code": s.step_code,
                    "name": s.step_name,
                    "status": s.status,
                    "module": s.module_code,
                    "error": s.error_message
                }
                for s in steps
            ],
            "error": onboarding.error_message,
            "started_at": onboarding.started_at.isoformat() if onboarding.started_at else None,
            "completed_at": onboarding.completed_at.isoformat() if onboarding.completed_at else None
        }

    # ========================================================================
    # PRIVATE HELPERS
    # ========================================================================

    def _load_template(self, template_code: str) -> Dict:
        """Load template from database or system presets."""
        # Check system templates first
        if template_code in SYSTEM_TEMPLATES:
            return SYSTEM_TEMPLATES[template_code]
        
        # Check database for custom template
        template = self.db.query(OnboardingTemplate).filter(
            OnboardingTemplate.code == template_code
        ).first()
        
        if not template:
            raise ValueError(f"Template '{template_code}' not found")
        
        return {
            "name": template.name,
            "modules": template.modules,
            "module_configurations": template.module_configurations,
            "global_configuration": template.global_configuration
        }

    def _merge_configurations(self, template: Dict, custom_config: Optional[Dict]) -> Dict:
        """Merge template config with custom overrides."""
        config = {
            "global": template.get("global_configuration", {}),
            "modules": template.get("module_configurations", {})
        }
        
        if custom_config:
            # Merge custom global config
            if "global" in custom_config:
                config["global"].update(custom_config["global"])
            
            # Merge custom module configs
            if "modules" in custom_config:
                for module, module_config in custom_config["modules"].items():
                    if module in config["modules"]:
                        config["modules"][module].update(module_config)
                    else:
                        config["modules"][module] = module_config
        
        return config

    def _create_onboarding_steps(
        self,
        onboarding: TenantOnboarding,
        template: Dict,
        config: Dict
    ):
        """Create step records based on module dependencies."""
        # Get modules to enable
        modules = template.get("modules", [])
        
        # Resolve dependencies (topological sort)
        sorted_modules = self._resolve_module_order(modules)
        
        order = 0
        
        # Add company setup step first
        company_step = OnboardingStep(
            id=uuid.uuid4(),
            onboarding_id=onboarding.id,
            step_code="company_setup",
            step_name="Setup Company",
            description="Configure company details and settings",
            order=order,
            status="PENDING"
        )
        self.db.add(company_step)
        order += 1
        
        # Add module setup steps
        for module_code in sorted_modules:
            module_step = OnboardingStep(
                id=uuid.uuid4(),
                onboarding_id=onboarding.id,
                step_code=f"module_{module_code}_setup",
                step_name=f"Setup {module_code.title()}",
                description=f"Configure {module_code} module",
                module_code=module_code,
                order=order,
                status="PENDING"
            )
            self.db.add(module_step)
            order += 1
        
        self.db.flush()

    def _resolve_module_order(self, modules: List[str]) -> List[str]:
        """
        Resolve module order using topological sort.
        Ensures dependencies are enabled before dependents.
        """
        # Build dependency graph for requested modules
        graph = defaultdict(list)
        in_degree = defaultdict(int)
        
        for module in modules:
            if module not in in_degree:
                in_degree[module] = 0
        
        # Add edges
        for module in modules:
            deps = MODULE_DEPENDENCIES.get(module, [])
            for dep in deps:
                if dep in modules:  # Only consider dependencies that are being enabled
                    graph[dep].append(module)
                    in_degree[module] += 1
        
        # Topological sort (Kahn's algorithm)
        queue = deque([m for m in modules if in_degree[m] == 0])
        sorted_modules = []
        
        while queue:
            module = queue.popleft()
            sorted_modules.append(module)
            
            for dependent in graph[module]:
                in_degree[dependent] -= 1
                if in_degree[dependent] == 0:
                    queue.append(dependent)
        
        if len(sorted_modules) != len(modules):
            raise ValueError("Circular dependency detected in modules")
        
        return sorted_modules

    def _execute_step(self, onboarding: TenantOnboarding, step: OnboardingStep) -> OnboardingStep:
        """Execute a single onboarding step."""
        step.status = "IN_PROGRESS"
        step.started_at = datetime.utcnow()
        onboarding.current_step = step.step_code
        
        self.db.commit()
        
        try:
            # Route to appropriate handler
            if step.step_code == "company_setup":
                result = self._execute_company_setup(onboarding)
            elif step.step_code.startswith("module_"):
                result = self._execute_module_setup(onboarding, step)
            else:
                raise ValueError(f"Unknown step: {step.step_code}")
            
            # Mark as completed
            step.status = "COMPLETED"
            step.result_data = result
            step.completed_at = datetime.utcnow()
            step.duration_seconds = int((step.completed_at - step.started_at).total_seconds())
            
            onboarding.steps_completed[step.step_code] = True
            
        except Exception as e:
            # Mark as failed
            step.status = "FAILED"
            step.error_message = str(e)
            step.completed_at = datetime.utcnow()
            
            onboarding.status = "FAILED"
            onboarding.error_message = str(e)
            onboarding.error_step = step.step_code
        
        self.db.commit()
        self.db.refresh(step)
        
        return step

    def _execute_company_setup(self, onboarding: TenantOnboarding) -> Dict:
        """Execute company setup step. Placeholder for adapter calls."""
        # In real implementation, call adapter.setup_step_company()
        # For now, return dummy result
        return {
            "company_id": "COMP-001",
            "created_at": datetime.utcnow().isoformat(),
            "status": "success"
        }

    def _execute_module_setup(self, onboarding: TenantOnboarding, step: OnboardingStep) -> Dict:
        """Execute module setup step."""
        module_code = step.module_code
        
        # Get module-specific configuration
        module_config = onboarding.configuration.get("modules", {}).get(module_code, {})
        
        # In real implementation, call adapter.setup_step_module(module_code, config)
        # For now, create TenantERPModule record
        
        tenant_id = onboarding.tenant_id
        
        module_record = TenantERPModule(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            module_code=module_code,
            module_name=module_code.title(),
            is_enabled=True,
            configuration=module_config,
            enabled_at=datetime.utcnow(),
            enabled_by=onboarding.started_by
        )
        self.db.add(module_record)
        self.db.flush()
        
        return {
            "module_id": str(module_record.id),
            "module_code": module_code,
            "created_at": datetime.utcnow().isoformat(),
            "status": "success"
        }

    def _get_active_onboarding(self, tenant_id: str, required: bool = True, include_paused: bool = False) -> Optional[TenantOnboarding]:
        """Get active onboarding for tenant (DRAFT, IN_PROGRESS, or optionally PAUSED)."""
        statuses = ["DRAFT", "IN_PROGRESS"]
        if include_paused:
            statuses.append("PAUSED")
        
        onboarding = self.db.query(TenantOnboarding).filter(
            TenantOnboarding.tenant_id == tenant_id,
            TenantOnboarding.status.in_(statuses)
        ).first()
        
        if required and not onboarding:
            raise ValueError(f"No active onboarding for tenant {tenant_id}")
        
        return onboarding


# Singleton instance
_orchestrator = None

def get_onboarding_orchestrator(db: Session) -> OnboardingOrchestrator:
    """Get or create orchestrator instance."""
    return OnboardingOrchestrator(db)
