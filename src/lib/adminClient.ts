import { apiFetch } from "./api";

export type AdminUserSummary = {
  id: number;
  museId: string | null;
  createdAt: string;
  role: "user" | "admin";
  displayName: string;
  photoURL: string;
  headerUrl: string;
  bio: string;
  gender: "male" | "female" | "other" | "secret";
  birthday: string;
  location: string;
  profileVisibility: "all" | "followers";
  contact: {
    email: string;
    phone: string;
    hasPassword: boolean;
  };
  activity: {
    favoriteArtifacts: number;
    favoriteExhibitions: number;
    exhibitions: number;
    publicExhibitions: number;
  };
};

export type AdminStatsResponse = {
  totalUsers: number;
  adminCount: number;
  museIdCount: number;
  usersWithContact: number;
  passwordLoginCount: number;
  codeLoginCount: number;
  totalFavoriteArtifacts: number;
  totalFavoriteExhibitions: number;
  totalExhibitions: number;
  publicExhibitions: number;
};

export async function getAdminUsers() {
  return apiFetch<{ users: AdminUserSummary[] }>("/api/admin/users");
}

export async function getAdminStats() {
  return apiFetch<AdminStatsResponse>("/api/admin/stats");
}
