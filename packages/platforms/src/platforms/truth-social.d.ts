export interface TruthSocialAccount {
  display_name: string;
  username: string;
  url: string;
  avatar: string;
}

export interface TruthSocialMedia {
  type: string;
  url: string;
  preview_url?: string;
  description?: string;
}

export interface TruthSocialStatus {
  id: string;
  created_at: string;
  url: string;
  content: string;
  account: TruthSocialAccount;
  replies_count: number;
  reblogs_count: number;
  favourites_count: number;
  media_attachments: TruthSocialMedia[];
  quote?: TruthSocialStatus | null;
  in_reply_to?: TruthSocialStatus | null;
}
