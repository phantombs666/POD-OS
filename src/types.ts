export interface Niche {
  id: string;
  name: string;
  score: number;
  competition: "low" | "medium" | "high";
  demand: "low" | "medium" | "high";
  profitability: number;
  trend: number;
  category: string;
  createdAt: string;
}

export interface Design {
  id: string;
  nicheId: string;
  nicheName: string;
  imageUrl: string;
  prompt: string;
  style: string;
  createdAt: string;
}

export interface Sale {
  id: string;
  designId: string;
  platform: string;
  revenue: number;
  profit: number;
  date: string;
}

export interface AutomationJob {
  id: string;
  name: string;
  status: "idle" | "running" | "completed" | "failed";
  progress: number;
  logs: string[];
  config: {
    nicheCount: number;
    designPerNiche: number;
    style: string;
  };
  createdAt: string;
}
