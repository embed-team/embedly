export interface TikTokImage {
  display_image?: {
    url_list?: string[];
  };
}

export interface TikTokItem {
  id_str: string;
  author_info: {
    unique_id: string;
    nickname: string;
    avatar_url_list: string[];
  };
  image_post_info?: {
    images: TikTokImage[];
  };
  video_info?: {
    url_list?: string[];
  };
  create_time?: number | null;
  desc: string;
  statistics_info: {
    comment_count: number;
    share_count: number;
    digg_count: number;
  };
}

export interface TikTokPlayerResponse {
  items?: TikTokItem[] | null;
  results?: Array<{
    id_str: string;
    code?: string | number;
  }>;
}
