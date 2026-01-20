"use client"

import * as React from "react"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { MessageSquare, Heart, Share2, MoreHorizontal } from "lucide-react"
import { formatDistanceToNow } from "@/lib/utils"

// Types
export interface FeedPost {
    id: string
    author: {
        name: string
        email: string
        tenantName?: string
    }
    content: string
    timestamp: Date
    likes: number
    comments: number
    isLiked?: boolean
}

// Mock data for development
const MOCK_POSTS: FeedPost[] = [
    {
        id: "1",
        author: { name: "James Nyokabi", email: "james@moran.com", tenantName: "Moran HQ" },
        content: "Just deployed the new multi-tenant authentication system! 🚀 Users can now seamlessly switch between workspaces.",
        timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 min ago
        likes: 12,
        comments: 3,
    },
    {
        id: "2",
        author: { name: "Wanjiku Kamau", email: "wanjiku@farmers.coop", tenantName: "Farmers Co-op" },
        content: "Harvest season update: All cooperative members have received their quarterly dividends through the platform. Transparency in action! 🌾",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
        likes: 45,
        comments: 8,
    },
    {
        id: "3",
        author: { name: "Otieno Ochieng", email: "otieno@ridersacco.ke", tenantName: "Rider Sacco" },
        content: "New feature request: Can we get real-time GPS tracking integration for fleet management? Would help our boda-boda members tremendously.",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
        likes: 23,
        comments: 15,
    },
    {
        id: "4",
        author: { name: "Mama Mboga", email: "mama@mboga.shop", tenantName: "Mama Mboga Shop" },
        content: "Stock inventory is now fully tracked in the system! No more manual counting. This platform is changing how we do business. 🥬📊",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
        likes: 67,
        comments: 12,
    },
]

// Post Card Component
function FeedPostCard({ post }: { post: FeedPost }) {
    const [isLiked, setIsLiked] = React.useState(post.isLiked || false)
    const [likeCount, setLikeCount] = React.useState(post.likes)

    const handleLike = () => {
        setIsLiked(!isLiked)
        setLikeCount(prev => isLiked ? prev - 1 : prev + 1)
    }

    return (
        <Card className="mb-4">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <Avatar>
                            <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                {post.author.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <div className="font-semibold text-sm">{post.author.name}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                                {post.author.tenantName && (
                                    <>
                                        <span>{post.author.tenantName}</span>
                                        <span>•</span>
                                    </>
                                )}
                                <span>{formatDistanceToNow(post.timestamp)}</span>
                            </div>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="pb-3">
                <p className="text-sm leading-relaxed">{post.content}</p>
            </CardContent>
            <CardFooter className="pt-0">
                <div className="flex items-center gap-1">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className={isLiked ? "text-red-500 hover:text-red-600" : ""}
                        onClick={handleLike}
                    >
                        <Heart className={`h-4 w-4 mr-1 ${isLiked ? "fill-current" : ""}`} />
                        {likeCount}
                    </Button>
                    <Button variant="ghost" size="sm">
                        <MessageSquare className="h-4 w-4 mr-1" />
                        {post.comments}
                    </Button>
                    <Button variant="ghost" size="sm">
                        <Share2 className="h-4 w-4 mr-1" />
                        Share
                    </Button>
                </div>
            </CardFooter>
        </Card>
    )
}

// Loading skeleton
function FeedSkeleton() {
    return (
        <Card className="mb-4">
            <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
            </CardContent>
        </Card>
    )
}

// Main Feed Component
export function Feed() {
    const [posts, setPosts] = React.useState<FeedPost[]>([])
    const [isLoading, setIsLoading] = React.useState(true)

    React.useEffect(() => {
        // Simulate API call
        const timer = setTimeout(() => {
            setPosts(MOCK_POSTS)
            setIsLoading(false)
        }, 500)

        return () => clearTimeout(timer)
    }, [])

    if (isLoading) {
        return (
            <div>
                <FeedSkeleton />
                <FeedSkeleton />
                <FeedSkeleton />
            </div>
        )
    }

    if (posts.length === 0) {
        return (
            <Card className="p-8 text-center">
                <p className="text-muted-foreground">No posts yet. Be the first to share something!</p>
            </Card>
        )
    }

    return (
        <div>
            {posts.map((post) => (
                <FeedPostCard key={post.id} post={post} />
            ))}
        </div>
    )
}
