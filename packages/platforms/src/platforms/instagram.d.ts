export interface InstagramImageCandidate {
  url: string;
}

export interface InstagramMedia {
  __typename?: string;
  code: string;
  taken_at: number;
  caption?: { text?: string } | null;
  user: {
    username: string;
    full_name?: string;
    profile_pic_url: string;
  };
  like_count?: number;
  comment_count?: number;
  product_type?: string;
  play_count?: number;
  video_play_count?: number;
  view_count?: number;
  accessibility_caption?: string;
  image_versions2?: {
    candidates?: InstagramImageCandidate[];
  };
  video_versions?: Array<{ url: string }>;
  carousel_media?: InstagramMedia[];
}
