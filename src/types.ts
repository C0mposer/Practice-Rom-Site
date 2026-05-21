export type GitHubAsset = {
  id: number;
  name: string;
  size: number;
  download_count: number;
  browser_download_url: string;
};

export type GitHubRelease = {
  name: string;
  tag_name: string;
  html_url: string;
  published_at: string;
  body: string;
  assets: GitHubAsset[];
};

export type WikiFile = {
  name: string;
  path: string;
  download_url: string;
  html_url: string;
  size: number;
  type: string;
};
