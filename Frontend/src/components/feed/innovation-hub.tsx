'use client';

import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { WorkspacesCard } from './workspaces-card';
import {
  Rocket,
  Lightbulb,
  Zap,
  Target,
  TrendingUp,
  Flame,
  Heart,
  MessageSquare,
  Share2,
  Bookmark,
  ArrowUpRight,
  Sparkles,
  Globe,
  Users,
  Trophy,
  ChevronRight,
  Play,
  Eye,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Star,
  Cpu,
  Layers,
} from 'lucide-react';

// Innovation content types
type ContentType = 'insight' | 'challenge' | 'opportunity' | 'breakthrough' | 'collab';

interface InnovationItem {
  id: string;
  type: ContentType;
  author: {
    name: string;
    avatar?: string;
    role: string;
    verified?: boolean;
  };
  title: string;
  summary: string;
  tags: string[];
  metrics: {
    views: number;
    reactions: number;
    comments: number;
    shares: number;
  };
  featured?: boolean;
  trending?: boolean;
  timeAgo: string;
  thumbnail?: string;
  status?: 'open' | 'in-progress' | 'completed';
  reward?: string;
}

// Mock data for innovation items
const MOCK_INNOVATIONS: InnovationItem[] = [
  {
    id: '1',
    type: 'breakthrough',
    author: {
      name: 'Dr. Sarah Chen',
      role: 'Chief Innovation Officer',
      verified: true,
    },
    title: 'Quantum-Resistant Supply Chain Verification',
    summary: 'We\'ve achieved a major milestone in implementing post-quantum cryptography for our distributed ledger. This breakthrough ensures supply chain integrity even against future quantum computing threats.',
    tags: ['Quantum', 'Blockchain', 'Security'],
    metrics: { views: 12400, reactions: 847, comments: 156, shares: 234 },
    featured: true,
    trending: true,
    timeAgo: '2 hours ago',
  },
  {
    id: '2',
    type: 'challenge',
    author: {
      name: 'Innovation Lab',
      role: 'Moran R&D',
      verified: true,
    },
    title: 'Zero-Latency Cross-Border Transactions',
    summary: 'Design a solution that enables real-time financial settlements across multiple currencies and jurisdictions. Top solutions will be implemented in Q2.',
    tags: ['FinTech', 'Challenge', 'Payments'],
    metrics: { views: 8900, reactions: 423, comments: 89, shares: 167 },
    status: 'open',
    reward: '$50,000',
    timeAgo: '5 hours ago',
  },
  {
    id: '3',
    type: 'opportunity',
    author: {
      name: 'Marcus Thompson',
      role: 'Strategic Partnerships',
    },
    title: 'AI-Powered Inventory Optimization Partnership',
    summary: 'Seeking teams to co-develop next-generation predictive inventory systems using federated learning. Access to anonymized datasets from 1M+ SKUs.',
    tags: ['AI/ML', 'Partnership', 'Inventory'],
    metrics: { views: 5600, reactions: 312, comments: 67, shares: 89 },
    status: 'open',
    timeAgo: '8 hours ago',
  },
  {
    id: '4',
    type: 'insight',
    author: {
      name: 'Elena Rodriguez',
      role: 'Data Science Lead',
    },
    title: 'The Future of Autonomous ERP: 2026 Predictions',
    summary: 'Our analysis of 50,000 enterprise workflows reveals 73% can be fully automated by 2027. Here\'s our roadmap for cognitive ERP systems.',
    tags: ['Automation', 'Trends', 'Research'],
    metrics: { views: 15200, reactions: 1123, comments: 234, shares: 456 },
    trending: true,
    timeAgo: '1 day ago',
  },
  {
    id: '5',
    type: 'collab',
    author: {
      name: 'Alex Kim',
      role: 'Product Engineering',
    },
    title: 'Open Source: Universal API Connector Framework',
    summary: 'Launching our open-source initiative for seamless multi-engine ERP integration. Contributors get early access to enterprise features.',
    tags: ['OpenSource', 'API', 'Integration'],
    metrics: { views: 7800, reactions: 567, comments: 123, shares: 234 },
    timeAgo: '2 days ago',
  },
];

const CATEGORIES = [
  { id: 'all', label: 'Discover', icon: Sparkles },
  { id: 'breakthroughs', label: 'Breakthroughs', icon: Rocket },
  { id: 'challenges', label: 'Challenges', icon: Target },
  { id: 'opportunities', label: 'Opportunities', icon: Zap },
  { id: 'insights', label: 'Insights', icon: Lightbulb },
  { id: 'collabs', label: 'Collaborate', icon: Users },
];

const TRENDING_TOPICS = [
  { name: 'Quantum Computing', count: 234 },
  { name: 'AI Agents', count: 189 },
  { name: 'Zero Trust', count: 156 },
  { name: 'Edge Computing', count: 134 },
  { name: 'Sustainable Tech', count: 112 },
];

// Type icon and color mapping
const TYPE_CONFIG: Record<ContentType, { icon: typeof Rocket; color: string; label: string; gradient: string }> = {
  breakthrough: {
    icon: Rocket,
    color: 'text-cyan-400',
    label: 'Breakthrough',
    gradient: 'from-cyan-500 to-blue-600',
  },
  challenge: {
    icon: Target,
    color: 'text-orange-400',
    label: 'Challenge',
    gradient: 'from-orange-500 to-red-600',
  },
  opportunity: {
    icon: Zap,
    color: 'text-emerald-400',
    label: 'Opportunity',
    gradient: 'from-emerald-500 to-teal-600',
  },
  insight: {
    icon: Lightbulb,
    color: 'text-purple-400',
    label: 'Insight',
    gradient: 'from-purple-500 to-pink-600',
  },
  collab: {
    icon: Users,
    color: 'text-pink-400',
    label: 'Collaboration',
    gradient: 'from-pink-500 to-rose-600',
  },
};

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

// Featured Innovation Card - Large hero card
function FeaturedCard({ item }: { item: InnovationItem }) {
  const config = TYPE_CONFIG[item.type];
  const Icon = config.icon;

  return (
    <div className="relative group rounded-3xl overflow-hidden">
      {/* Animated gradient background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient} opacity-20 group-hover:opacity-30 transition-opacity duration-500`} />
      
      {/* Glassmorphism card */}
      <div className="relative glass-strong rounded-3xl p-8 border border-white/10 hover:border-white/20 transition-all duration-500">
        {/* Floating orbs decoration */}
        <div className="absolute top-4 right-4 w-32 h-32 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-4 left-4 w-24 h-24 bg-gradient-to-br from-pink-500/20 to-orange-500/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />
        
        <div className="relative z-10">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl bg-gradient-to-br ${config.gradient}`}>
                <Icon className="h-5 w-5 text-white" />
              </div>
              <Badge variant="secondary" className="bg-white/10 border-white/20 text-white/90">
                <Flame className="h-3 w-3 mr-1 text-orange-400" />
                Featured
              </Badge>
              {item.trending && (
                <Badge variant="secondary" className="bg-white/10 border-white/20 text-white/90">
                  <TrendingUp className="h-3 w-3 mr-1 text-emerald-400" />
                  Trending
                </Badge>
              )}
            </div>
            <span className="text-white/50 text-sm">{item.timeAgo}</span>
          </div>

          {/* Author */}
          <div className="flex items-center gap-3 mb-6">
            <Avatar className="h-12 w-12 ring-2 ring-white/20">
              <AvatarImage src={item.author.avatar} />
              <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white font-bold">
                {item.author.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">{item.author.name}</span>
                {item.author.verified && (
                  <div className="p-0.5 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500">
                    <Star className="h-3 w-3 text-white fill-white" />
                  </div>
                )}
              </div>
              <span className="text-white/50 text-sm">{item.author.role}</span>
            </div>
          </div>

          {/* Content */}
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4 leading-tight">
            {item.title}
          </h2>
          <p className="text-white/70 text-lg leading-relaxed mb-6">
            {item.summary}
          </p>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-8">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 rounded-full text-sm font-medium bg-white/10 text-white/80 hover:bg-white/20 transition-colors cursor-pointer"
              >
                #{tag}
              </span>
            ))}
          </div>

          {/* Footer metrics and actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6 text-white/50">
              <span className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                {formatNumber(item.metrics.views)}
              </span>
              <span className="flex items-center gap-2">
                <Heart className="h-4 w-4" />
                {formatNumber(item.metrics.reactions)}
              </span>
              <span className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                {item.metrics.comments}
              </span>
            </div>
            <Button className={`bg-gradient-to-r ${config.gradient} text-white border-0 hover:opacity-90 group/btn`}>
              Explore
              <ArrowUpRight className="h-4 w-4 ml-2 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Innovation Card - Regular size
function InnovationCard({ item }: { item: InnovationItem }) {
  const config = TYPE_CONFIG[item.type];
  const Icon = config.icon;

  return (
    <div className="group relative">
      {/* Gradient border effect on hover */}
      <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${config.gradient} opacity-0 group-hover:opacity-100 blur transition-opacity duration-500`} style={{ margin: '-2px' }} />
      
      <div className="relative glass rounded-2xl p-6 hover:bg-white/10 transition-all duration-300 cursor-pointer">
        {/* Type badge and time */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg bg-gradient-to-br ${config.gradient}`}>
              <Icon className="h-4 w-4 text-white" />
            </div>
            <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
          </div>
          <div className="flex items-center gap-2">
            {item.trending && (
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            )}
            <span className="text-white/40 text-sm">{item.timeAgo}</span>
          </div>
        </div>

        {/* Challenge/Opportunity status */}
        {item.status && (
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="outline" className={`
              ${item.status === 'open' ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10' : ''}
              ${item.status === 'in-progress' ? 'border-orange-500/50 text-orange-400 bg-orange-500/10' : ''}
              ${item.status === 'completed' ? 'border-blue-500/50 text-blue-400 bg-blue-500/10' : ''}
            `}>
              {item.status === 'open' && '● Open'}
              {item.status === 'in-progress' && '◐ In Progress'}
              {item.status === 'completed' && '✓ Completed'}
            </Badge>
            {item.reward && (
              <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                <Trophy className="h-3 w-3 mr-1" />
                {item.reward}
              </Badge>
            )}
          </div>
        )}

        {/* Title */}
        <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-cyan-300 transition-colors line-clamp-2">
          {item.title}
        </h3>

        {/* Summary */}
        <p className="text-white/60 text-sm leading-relaxed mb-4 line-clamp-2">
          {item.summary}
        </p>

        {/* Author */}
        <div className="flex items-center gap-2 mb-4">
          <Avatar className="h-6 w-6">
            <AvatarImage src={item.author.avatar} />
            <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white text-xs">
              {item.author.name.split(' ').map(n => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          <span className="text-white/70 text-sm">{item.author.name}</span>
          {item.author.verified && (
            <Star className="h-3 w-3 text-cyan-400 fill-cyan-400" />
          )}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {item.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/5 text-white/60"
            >
              #{tag}
            </span>
          ))}
        </div>

        {/* Metrics */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          <div className="flex items-center gap-4 text-white/40 text-sm">
            <span className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              {formatNumber(item.metrics.views)}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" />
              {formatNumber(item.metrics.reactions)}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" />
              {item.metrics.comments}
            </span>
          </div>
          <button className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors">
            <Bookmark className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Trending Topics Sidebar
function TrendingSidebar() {
  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-6">
        <Flame className="h-5 w-5 text-orange-400" />
        <h3 className="font-semibold text-white">Trending Topics</h3>
      </div>
      <div className="space-y-3">
        {TRENDING_TOPICS.map((topic, index) => (
          <div
            key={topic.name}
            className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors group"
          >
            <div className="flex items-center gap-3">
              <span className="text-white/30 font-mono text-sm">#{index + 1}</span>
              <span className="text-white/90 group-hover:text-cyan-300 transition-colors">
                {topic.name}
              </span>
            </div>
            <span className="text-white/40 text-sm">{topic.count}</span>
          </div>
        ))}
      </div>
      <Button variant="ghost" className="w-full mt-4 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10">
        View All Topics
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
}

// Quick Stats Widget
function QuickStats() {
  const stats = [
    { label: 'Active Challenges', value: '24', icon: Target, color: 'text-orange-400' },
    { label: 'Innovations Today', value: '156', icon: Lightbulb, color: 'text-purple-400' },
    { label: 'Active Collaborators', value: '2.4K', icon: Users, color: 'text-cyan-400' },
  ];

  return (
    <div className="grid grid-cols-3 gap-4 mb-8">
      {stats.map((stat) => (
        <div key={stat.label} className="glass rounded-xl p-4 text-center">
          <stat.icon className={`h-6 w-6 mx-auto mb-2 ${stat.color}`} />
          <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
          <div className="text-white/50 text-sm">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}

// Main Innovation Hub Component
export function InnovationHub() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [isLoading, setIsLoading] = useState(false);

  const featuredItem = MOCK_INNOVATIONS.find(item => item.featured);
  const regularItems = MOCK_INNOVATIONS.filter(item => !item.featured);

  if (isLoading) {
    return <InnovationHubSkeleton />;
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative mb-10">
        {/* Decorative elements */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-20 right-1/4 w-64 h-64 bg-gradient-to-br from-pink-500/10 to-orange-500/10 rounded-full blur-3xl" />
        
        <div className="relative">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600">
                  <Cpu className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-4xl md:text-5xl font-bold gradient-text">
                  Innovation Hub
                </h1>
              </div>
              <p className="text-white/60 text-lg max-w-xl">
                Where breakthrough ideas meet enterprise execution. Discover, collaborate, and shape the future of business.
              </p>
            </div>
            <Button className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white border-0 hover:opacity-90 h-12 px-6">
              <Plus className="h-5 w-5 mr-2" />
              Share Innovation
            </Button>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
              <Input
                placeholder="Search innovations, challenges, insights..."
                className="h-12 pl-12 bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-cyan-500/50 focus:ring-cyan-500/20"
              />
            </div>
            <Button variant="outline" className="h-12 border-white/20 text-white/80 hover:bg-white/10">
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>

          {/* Category Navigation */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`
                    flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium whitespace-nowrap transition-all duration-300
                    ${isActive 
                      ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-lg shadow-purple-500/25' 
                      : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80'
                    }
                  `}
                >
                  <cat.icon className="h-4 w-4" />
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <QuickStats />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Feed */}
        <div className="lg:col-span-2 space-y-6">
          {/* Featured Card */}
          {featuredItem && <FeaturedCard item={featuredItem} />}
          
          {/* Regular Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {regularItems.map((item) => (
              <InnovationCard key={item.id} item={item} />
            ))}
          </div>

          {/* Load More */}
          <div className="text-center pt-4">
            <Button variant="outline" className="border-white/20 text-white/70 hover:bg-white/10">
              <Layers className="h-4 w-4 mr-2" />
              Load More Innovations
            </Button>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* My Workspaces - Prominent placement */}
          <WorkspacesCard />
          
          <TrendingSidebar />
          
          {/* Live Activity Widget */}
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="font-semibold text-white">Live Activity</h3>
            </div>
            <div className="space-y-4">
              {[
                { action: 'started a challenge', user: 'Alex K.', time: '2m ago' },
                { action: 'shared a breakthrough', user: 'Maya R.', time: '5m ago' },
                { action: 'joined collaboration', user: 'James T.', time: '8m ago' },
              ].map((activity, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white text-xs">
                      {activity.user.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <span className="text-white/80">{activity.user}</span>
                    <span className="text-white/40"> {activity.action}</span>
                  </div>
                  <span className="text-white/30 text-xs">{activity.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Innovators */}
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="h-5 w-5 text-yellow-400" />
              <h3 className="font-semibold text-white">Top Innovators</h3>
            </div>
            <div className="space-y-3">
              {[
                { name: 'Dr. Sarah Chen', points: '12,450', rank: 1 },
                { name: 'Marcus Thompson', points: '10,820', rank: 2 },
                { name: 'Elena Rodriguez', points: '9,340', rank: 3 },
              ].map((innovator) => (
                <div key={innovator.name} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors">
                  <div className={`
                    w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                    ${innovator.rank === 1 ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white' : ''}
                    ${innovator.rank === 2 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-800' : ''}
                    ${innovator.rank === 3 ? 'bg-gradient-to-br from-orange-300 to-orange-400 text-orange-800' : ''}
                  `}>
                    {innovator.rank}
                  </div>
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-600 text-white text-xs">
                      {innovator.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="text-white/90 text-sm font-medium">{innovator.name}</div>
                    <div className="text-white/40 text-xs">{innovator.points} pts</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Loading skeleton
function InnovationHubSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Skeleton className="h-12 w-64 bg-white/10" />
        <Skeleton className="h-6 w-96 bg-white/10" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-80 rounded-3xl bg-white/10" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-64 rounded-2xl bg-white/10" />
            <Skeleton className="h-64 rounded-2xl bg-white/10" />
          </div>
        </div>
        <div className="space-y-6">
          <Skeleton className="h-80 rounded-2xl bg-white/10" />
          <Skeleton className="h-48 rounded-2xl bg-white/10" />
        </div>
      </div>
    </div>
  );
}

export default InnovationHub;
