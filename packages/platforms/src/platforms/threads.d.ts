export interface ThreadsPost {
  carousel_media?: ThreadsPost[];
  video_versions?: Array<{ url: string }>;
  image_versions2?: {
    candidates?: Array<{ url: string }>;
  };
  accessibility_caption?: string;
  user: {
    full_name: string;
    profile_pic_url: string;
    username: string;
  };
  caption: { text: string };
  text_post_app_info: {
    direct_reply_count: number;
    reshare_count: number | null;
  };
  like_count: number;
  code: string;
  taken_at: number;
  media_overlay_info?: {
    buttons?: Array<{ text: string }>;
  };
}

export interface ThreadsResponse {
  status?: string;
  data?: {
    data?: {
      edges?: Array<{
        node?: {
          thread_items?: Array<{ post?: ThreadsPost }>;
        };
      }>;
    };
  };
}
