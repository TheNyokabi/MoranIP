"""
White-Label Branding Service

Provides:
- Complete visual customization
- Custom domain management
- Email branding
- Receipt/Invoice customization
- CSS generation
"""

import logging
from datetime import datetime
from typing import Dict, Optional, Any

from sqlalchemy.orm import Session

from ...models.enterprise import TenantBranding

logger = logging.getLogger(__name__)


class BrandingService:
    """Service for white-label branding management"""
    
    def __init__(self, db: Session, tenant_id: str):
        self.db = db
        self.tenant_id = tenant_id
    
    def get_branding(self) -> TenantBranding:
        """Get or create tenant branding"""
        branding = self.db.query(TenantBranding).filter(
            TenantBranding.tenant_id == self.tenant_id
        ).first()
        
        if not branding:
            branding = TenantBranding(tenant_id=self.tenant_id)
            self.db.add(branding)
            self.db.commit()
            self.db.refresh(branding)
        
        return branding
    
    def update_branding(self, updates: Dict[str, Any]) -> TenantBranding:
        """Update branding settings"""
        branding = self.get_branding()
        
        allowed_fields = [
            'primary_color', 'secondary_color', 'accent_color',
            'background_color', 'text_color',
            'logo_url', 'logo_dark_url', 'favicon_url',
            'banner_url', 'login_background_url',
            'company_name', 'tagline',
            'support_email', 'support_phone', 'website_url',
            'email_logo_url', 'email_header_color', 'email_footer_text',
            'email_from_name', 'email_reply_to',
            'receipt_logo_url', 'receipt_header', 'receipt_footer',
            'invoice_logo_url', 'invoice_terms',
            'font_family', 'heading_font_family',
            'custom_css', 'border_radius',
            'show_powered_by'
        ]
        
        for field, value in updates.items():
            if field in allowed_fields:
                setattr(branding, field, value)
        
        self.db.commit()
        self.db.refresh(branding)
        
        logger.info(f"Updated branding for tenant {self.tenant_id}")
        return branding
    
    def set_custom_domain(
        self,
        domain: str,
        ssl_certificate: Optional[str] = None,
        ssl_private_key: Optional[str] = None
    ) -> bool:
        """Set custom domain for tenant"""
        branding = self.get_branding()
        
        branding.custom_domain = domain
        branding.custom_domain_verified = False
        
        if ssl_certificate and ssl_private_key:
            branding.ssl_certificate = ssl_certificate
            branding.ssl_private_key = ssl_private_key
        
        self.db.commit()
        
        logger.info(f"Set custom domain {domain} for tenant {self.tenant_id}")
        return True
    
    def verify_custom_domain(self) -> bool:
        """Verify custom domain DNS configuration"""
        branding = self.get_branding()
        
        if not branding.custom_domain:
            return False
        
        # TODO: Implement DNS verification
        # Check for CNAME or A record pointing to our server
        
        branding.custom_domain_verified = True
        self.db.commit()
        
        return True
    
    def generate_css_variables(self) -> str:
        """Generate CSS custom properties from branding"""
        branding = self.get_branding()
        
        css = f"""
:root {{
    --brand-primary: {branding.primary_color};
    --brand-secondary: {branding.secondary_color};
    --brand-accent: {branding.accent_color};
    --brand-background: {branding.background_color};
    --brand-text: {branding.text_color};
    --brand-radius: {branding.border_radius};
    --brand-font: "{branding.font_family}", sans-serif;
    --brand-heading-font: "{branding.heading_font_family or branding.font_family}", sans-serif;
}}

/* Auto-generated color variants */
.bg-brand-primary {{ background-color: var(--brand-primary); }}
.bg-brand-secondary {{ background-color: var(--brand-secondary); }}
.text-brand-primary {{ color: var(--brand-primary); }}
.border-brand-primary {{ border-color: var(--brand-primary); }}
"""
        
        if branding.custom_css:
            css += f"\n/* Custom CSS */\n{branding.custom_css}"
        
        return css
    
    def get_email_template_vars(self) -> Dict[str, Any]:
        """Get variables for email templates"""
        branding = self.get_branding()
        
        return {
            "logo_url": branding.email_logo_url or branding.logo_url,
            "company_name": branding.company_name,
            "header_color": branding.email_header_color,
            "footer_text": branding.email_footer_text,
            "support_email": branding.support_email,
            "website_url": branding.website_url,
            "primary_color": branding.primary_color
        }
    
    def get_receipt_template_vars(self) -> Dict[str, Any]:
        """Get variables for receipt templates"""
        branding = self.get_branding()
        
        return {
            "logo_url": branding.receipt_logo_url or branding.logo_url,
            "company_name": branding.company_name,
            "header": branding.receipt_header,
            "footer": branding.receipt_footer,
            "support_phone": branding.support_phone
        }
    
    def get_invoice_template_vars(self) -> Dict[str, Any]:
        """Get variables for invoice templates"""
        branding = self.get_branding()
        
        return {
            "logo_url": branding.invoice_logo_url or branding.logo_url,
            "company_name": branding.company_name,
            "address": None,  # From tenant settings
            "terms": branding.invoice_terms,
            "support_email": branding.support_email,
            "website_url": branding.website_url
        }
    
    def get_public_branding(self) -> Dict[str, Any]:
        """Get public-safe branding info (no secrets)"""
        branding = self.get_branding()
        
        return {
            "primary_color": branding.primary_color,
            "secondary_color": branding.secondary_color,
            "accent_color": branding.accent_color,
            "background_color": branding.background_color,
            "text_color": branding.text_color,
            "logo_url": branding.logo_url,
            "logo_dark_url": branding.logo_dark_url,
            "favicon_url": branding.favicon_url,
            "company_name": branding.company_name,
            "tagline": branding.tagline,
            "font_family": branding.font_family,
            "heading_font_family": branding.heading_font_family,
            "border_radius": branding.border_radius,
            "show_powered_by": branding.show_powered_by,
            "custom_domain": branding.custom_domain if branding.custom_domain_verified else None
        }
