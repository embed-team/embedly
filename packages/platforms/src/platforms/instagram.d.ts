interface IGDisplayResource {
  src: string;
  config_width: number;
  config_height: number;
}

interface IGOwner {
  id: string;
  username: string;
  is_verified: boolean;
  profile_pic_url: string;
  blocked_by_viewer: boolean;
  restricted_by_viewer: boolean | null;
  followed_by_viewer: boolean;
  full_name: string;
  has_blocked_viewer: boolean;
  is_embeds_disabled: boolean;
  is_private: boolean;
  is_unpublished: boolean;
  requested_by_viewer: boolean;
  pass_tiering_recommendation: boolean;
  edge_owner_to_timeline_media: { count: number };
  edge_followed_by: { count: number };
}

interface IGUser {
  id: string;
  is_verified: boolean;
  profile_pic_url: string;
  username: string;
}

interface IGPageInfo {
  has_next_page: boolean;
  end_cursor: string;
}

interface IGEdgeCount {
  count: number;
  edges: unknown[];
}

interface IGEdgeCountPaged {
  count: number;
  page_info: IGPageInfo;
  edges: unknown[];
}

interface IGMediaBase {
  id: string;
  shortcode: string;
  thumbnail_src: string;
  dimensions: { height: number; width: number };
  gating_info: null;
  fact_check_overall_rating: null;
  fact_check_information: null;
  sensitivity_friction_info: null;
  sharing_friction_info: { should_have_sharing_friction: boolean; bloks_app_url: string | null };
  media_overlay_info: null;
  media_preview: string | null;
  display_url: string;
  display_resources: IGDisplayResource[];
  accessibility_caption: string | null;
  tracking_token: string;
  upcoming_event: null;
  edge_media_to_tagged_user: { edges: unknown[] };
  owner: IGOwner;
  edge_media_to_caption: { edges: Array<{ node: { text: string } }> };
  can_see_insights_as_brand: boolean;
  caption_is_edited: boolean;
  has_ranked_comments: boolean;
  like_and_view_counts_disabled: boolean;
  edge_media_to_comment: IGEdgeCountPaged;
  comments_disabled: boolean;
  commenting_disabled_for_viewer: boolean;
  taken_at_timestamp: number;
  edge_media_preview_like: IGEdgeCount;
  edge_media_to_sponsor_user: { edges: unknown[] };
  is_affiliate: boolean;
  is_paid_partnership: boolean;
  location: null;
  nft_asset_info: null;
  viewer_has_liked: boolean;
  viewer_has_saved: boolean;
  viewer_has_saved_to_collection: boolean;
  viewer_in_photo_of_you: boolean;
  viewer_can_reshare: boolean;
  is_ad: boolean;
  edge_web_media_to_related_media: { edges: unknown[] };
  coauthor_producers: IGUser[];
  pinned_for_users: IGUser[];
  edge_related_profiles: { edges: unknown[] };
}

export interface XDTGraphImage extends IGMediaBase {
  __typename: "XDTGraphImage";
  __isXDTGraphMediaInterface: "XDTGraphImage";
  is_video: false;
}

export interface XDTGraphSidecar extends IGMediaBase {
  __typename: "XDTGraphSidecar";
  __isXDTGraphMediaInterface: "XDTGraphSidecar";
  is_video: false;
  edge_sidecar_to_children: { edges: Array<{ node: XDTGraphImage | XDTGraphVideo }> };
}

export interface XDTGraphVideo extends IGMediaBase {
  __typename: "XDTGraphVideo";
  __isXDTGraphMediaInterface: "XDTGraphVideo";
  is_video: true;
  has_audio: boolean;
  video_url: string;
  video_view_count: number;
  video_play_count: number;
  video_duration: number;
  encoding_status: null;
  is_published: boolean;
  product_type: string;
  title: string;
  dash_info: {
    is_dash_eligible: boolean;
    video_dash_manifest: string;
    number_of_qualities: number;
  };
  clips_music_attribution_info: {
    artist_name: string;
    song_name: string;
    uses_original_audio: boolean;
    should_mute_audio: boolean;
    should_mute_audio_reason: string;
    audio_id: string;
  } | null;
}

export type IGMedia = XDTGraphImage | XDTGraphSidecar | XDTGraphVideo;
