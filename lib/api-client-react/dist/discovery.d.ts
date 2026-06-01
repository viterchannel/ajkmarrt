import type { Banner, RecommendationProduct, WishlistItem } from "@workspace/api-zod";
export type { Banner, RecommendationProduct, WishlistItem };
export declare const getBanners: (params?: {
    placement?: string;
    service?: string;
}, options?: RequestInit) => Promise<Banner[]>;
export declare const getTrending: (params?: {
    limit?: number;
}, options?: RequestInit) => Promise<RecommendationProduct[]>;
export declare const getForYou: (params?: {
    limit?: number;
}, options?: RequestInit) => Promise<RecommendationProduct[]>;
export declare const getSimilar: (productId: string, params?: {
    limit?: number;
}, options?: RequestInit) => Promise<RecommendationProduct[]>;
export declare const trackInteraction: (body: {
    productId: string;
    type: "view" | "add_to_cart" | "purchase" | "wishlist";
}, options?: RequestInit) => Promise<any>;
export declare const getProductVariants: (productId: string, options?: RequestInit) => Promise<any[]>;
export interface FlashDealProduct {
    id: string;
    name: string;
    price: string;
    originalPrice: string;
    image: string | null;
    category: string | null;
    rating: number | null;
    vendorName: string | null;
    unit: string | null;
    discountPercent: number;
    dealExpiresAt: string;
    dealStock: number | null;
    soldCount: number;
}
export interface HomeFeedResponse {
    banners: Banner[];
    flashDeals: FlashDealProduct[];
    trending: RecommendationProduct[];
}
export declare const getHomeFeed: (params?: {
    placement?: string;
    service?: string;
    flashLimit?: number;
    trendingLimit?: number;
}, options?: RequestInit) => Promise<HomeFeedResponse>;
export declare const getFlashDeals: (params?: {
    limit?: number;
}, options?: RequestInit) => Promise<FlashDealProduct[]>;
export interface SearchProductsParams {
    q: string;
    type?: string;
    category?: string;
    sort?: string;
    minPrice?: string;
    maxPrice?: string;
    minRating?: string;
    page?: number;
    perPage?: number;
}
export interface SearchProductsResponse {
    products: Array<{
        id: string;
        name: string;
        price: string;
        image: string | null;
        category: string | null;
        originalPrice?: string;
        rating: number | null;
        vendorName: string | null;
        type: string | null;
    }>;
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
}
export declare const searchProducts: (params: SearchProductsParams, options?: RequestInit) => Promise<SearchProductsResponse>;
export interface HierarchicalCategory {
    id: string;
    name: string;
    icon: string;
    type: string;
    parentId: string | null;
    sortOrder: number;
    productCount: number;
    children: HierarchicalCategory[];
}
export declare const getHierarchicalCategories: (params?: {
    type?: string;
}, options?: RequestInit) => Promise<HierarchicalCategory[]>;
export declare const getTrendingSearches: (params?: {
    limit?: number;
}, options?: RequestInit) => Promise<string[]>;
export declare const getWishlist: (options?: RequestInit) => Promise<WishlistItem[]>;
export declare const addToWishlist: (productId: string, options?: RequestInit) => Promise<{
    success: boolean;
    id: string;
}>;
export declare const removeFromWishlist: (productId: string, options?: RequestInit) => Promise<{
    success: boolean;
}>;
export declare const checkWishlist: (productId: string, options?: RequestInit) => Promise<boolean>;
export interface ProductReview {
    id: string;
    userId: string;
    userName: string;
    rating: number;
    comment: string | null;
    photos: string[];
    createdAt: string;
    vendorReply: string | null;
    vendorRepliedAt: string | null;
}
export interface ProductReviewsResponse {
    reviews: ProductReview[];
    total: number;
    page: number;
    pages: number;
}
export declare const getProductReviews: (productId: string, params?: {
    page?: number;
    limit?: number;
}, options?: RequestInit) => Promise<ProductReviewsResponse>;
export interface ReviewSummary {
    average: number;
    total: number;
    distribution: Record<number, number>;
}
export declare const getProductReviewSummary: (productId: string, options?: RequestInit) => Promise<ReviewSummary>;
export declare const checkCanReviewProduct: (productId: string, options?: RequestInit) => Promise<{
    canReview: boolean;
    hasPurchased: boolean;
    alreadyReviewed: boolean;
}>;
export declare const submitProductReview: (body: {
    orderId?: string;
    orderType: string;
    rating: number;
    comment?: string;
    productId?: string;
    photos?: string[];
}, options?: RequestInit) => Promise<Record<string, unknown>>;
export declare const uploadImage: (file: string, mimeType?: string, options?: RequestInit) => Promise<{
    url: string;
}>;
export declare const subscribeStockNotify: (productId: string, options?: RequestInit) => Promise<{
    subscribed: boolean;
}>;
export declare const unsubscribeStockNotify: (productId: string, options?: RequestInit) => Promise<{
    subscribed: boolean;
}>;
export declare const checkStockNotifySubscription: (productId: string, options?: RequestInit) => Promise<{
    subscribed: boolean;
}>;
//# sourceMappingURL=discovery.d.ts.map