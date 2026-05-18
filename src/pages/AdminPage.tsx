import React, { useEffect, useState } from "react";
import { AuthService } from "../auth/AuthService";
import { UserSession } from "../auth/UserSession";
import { getAdminStats, getAdminUsers, type AdminStatsResponse, type AdminUserSummary } from "../lib/adminClient";
import { me } from "../lib/authClient";
import { ForbiddenPage } from "./ForbiddenPage";
import { navigate } from "../router/router";

const genderLabels: Record<AdminUserSummary["gender"], string> = {
  male: "男",
  female: "女",
  other: "其他",
  secret: "保密",
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("zh-CN", { hour12: false });
}

export function AdminPage() {
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadAdminData = async () => {
      setLoading(true);
      setError(null);
      setForbidden(false);

      try {
        const currentUser = await me();
        if (currentUser.profile.role !== "admin") {
          if (!cancelled) {
            setForbidden(true);
          }
          return;
        }

        const [usersResponse, statsResponse] = await Promise.all([getAdminUsers(), getAdminStats()]);
        if (cancelled) {
          return;
        }

        setUsers(usersResponse.users);
        setStats(statsResponse);
      } catch (e) {
        if (cancelled) {
          return;
        }

        const message = e instanceof Error ? e.message : String(e);
        if (message.includes("Forbidden")) {
          setForbidden(true);
          return;
        }
        if (message.includes("Authorization") || message.includes("401")) {
          navigate("/login");
          return;
        }
        setError(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadAdminData();
    return () => {
      cancelled = true;
    };
  }, []);

  const onLogout = async () => {
    await AuthService.logout();
    navigate("/login");
  };

  if (forbidden) {
    return <ForbiddenPage />;
  }

  const regularUserCount = stats ? Math.max(stats.totalUsers - stats.adminCount, 0) : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="text-xs font-black uppercase tracking-[0.24em] text-amber-800">Admin Console</div>
            <div className="text-2xl font-black text-gray-900">MuseLink 后台管理</div>
            <div className="text-sm text-gray-500">
              当前管理员：{UserSession.getMuseId() || "jiangzhong"}，可查看系统用户与账号统计。
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => navigate("/home")}
              className="px-4 py-2 rounded-2xl bg-gray-100 text-gray-700 text-sm font-bold"
            >
              返回前台
            </button>
            <button
              onClick={onLogout}
              className="px-4 py-2 rounded-2xl bg-rose-50 text-rose-700 text-sm font-bold"
            >
              退出登录
            </button>
          </div>
        </div>

        {loading && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 text-sm text-gray-500">
            正在加载后台数据...
          </div>
        )}

        {!loading && error && (
          <div className="bg-rose-50 border border-rose-100 rounded-3xl p-6 text-sm text-rose-700">
            后台数据加载失败：{error}
          </div>
        )}

        {!loading && !error && stats && (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                <div className="text-xs font-bold uppercase tracking-[0.24em] text-gray-400">Total Users</div>
                <div className="mt-3 text-3xl font-black text-gray-900">{stats.totalUsers}</div>
                <div className="mt-1 text-sm text-gray-500">系统中的用户总数</div>
              </div>

              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                <div className="text-xs font-bold uppercase tracking-[0.24em] text-gray-400">Admins</div>
                <div className="mt-3 text-3xl font-black text-amber-800">{stats.adminCount}</div>
                <div className="mt-1 text-sm text-gray-500">拥有后台权限的账号数量</div>
              </div>

              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                <div className="text-xs font-bold uppercase tracking-[0.24em] text-gray-400">Members</div>
                <div className="mt-3 text-3xl font-black text-emerald-700">{regularUserCount}</div>
                <div className="mt-1 text-sm text-gray-500">普通用户账号数量</div>
              </div>

              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                <div className="text-xs font-bold uppercase tracking-[0.24em] text-gray-400">Contacts</div>
                <div className="mt-3 text-3xl font-black text-sky-700">{stats.usersWithContact}</div>
                <div className="mt-1 text-sm text-gray-500">绑定手机或邮箱的用户</div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                <div className="text-xs font-bold text-gray-400">MuseLink ID</div>
                <div className="mt-2 text-2xl font-black text-gray-900">{stats.museIdCount}</div>
              </div>
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                <div className="text-xs font-bold text-gray-400">密码登录账号</div>
                <div className="mt-2 text-2xl font-black text-gray-900">{stats.passwordLoginCount}</div>
              </div>
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                <div className="text-xs font-bold text-gray-400">验证码登录账号</div>
                <div className="mt-2 text-2xl font-black text-gray-900">{stats.codeLoginCount}</div>
              </div>
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                <div className="text-xs font-bold text-gray-400">公开展陈</div>
                <div className="mt-2 text-2xl font-black text-gray-900">
                  {stats.publicExhibitions}/{stats.totalExhibitions}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100">
                <div className="text-lg font-black text-gray-900">用户列表</div>
                <div className="text-sm text-gray-500 mt-1">管理员可查看用户资料、联系方式状态与内容数据统计。</div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-5 py-3 text-left font-bold">用户</th>
                      <th className="px-5 py-3 text-left font-bold">账号</th>
                      <th className="px-5 py-3 text-left font-bold">个人资料</th>
                      <th className="px-5 py-3 text-left font-bold">联系方式</th>
                      <th className="px-5 py-3 text-left font-bold">用户数据</th>
                      <th className="px-5 py-3 text-left font-bold">创建时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-t border-gray-100">
                        <td className="px-5 py-4 align-top">
                          <div className="flex min-w-64 items-start gap-3">
                            <img
                              src={user.photoURL}
                              alt=""
                              className="h-12 w-12 rounded-2xl object-cover bg-gray-100"
                              referrerPolicy="no-referrer"
                            />
                            <div>
                              <div className="font-black text-gray-900">{user.displayName || "未命名用户"}</div>
                              <div className="mt-1 font-mono text-xs text-gray-500">#{user.id}</div>
                              <span
                                className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-black ${
                                  user.role === "admin"
                                    ? "bg-amber-100 text-amber-900"
                                    : "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {user.role === "admin" ? "管理员" : "用户"}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="space-y-2 text-gray-700">
                            <div>
                              <span className="text-gray-400">MuseLink ID：</span>
                              <span className="font-mono">{user.museId || "-"}</span>
                            </div>
                            <div>
                              <span className="text-gray-400">登录方式：</span>
                              {user.contact.hasPassword ? "密码" : "验证码"}
                            </div>
                            <div>
                              <span className="text-gray-400">可见性：</span>
                              {user.profileVisibility === "all" ? "所有人" : "关注者"}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="min-w-64 space-y-2 text-gray-700">
                            <div>
                              <span className="text-gray-400">性别：</span>
                              {genderLabels[user.gender]}
                            </div>
                            <div>
                              <span className="text-gray-400">生日：</span>
                              {user.birthday || "-"}
                            </div>
                            <div>
                              <span className="text-gray-400">地区：</span>
                              {user.location || "-"}
                            </div>
                            <div className="max-w-72 text-gray-500">
                              {user.bio || "暂无简介"}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="min-w-56 space-y-2 text-gray-700">
                            <div>
                              <span className="text-gray-400">邮箱：</span>
                              {user.contact.email || "-"}
                            </div>
                            <div>
                              <span className="text-gray-400">手机：</span>
                              {user.contact.phone || "-"}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="grid min-w-56 grid-cols-2 gap-2 text-xs">
                            <div className="rounded-2xl bg-gray-50 p-3">
                              <div className="font-black text-gray-900">{user.activity.favoriteArtifacts}</div>
                              <div className="mt-1 text-gray-400">文物收藏</div>
                            </div>
                            <div className="rounded-2xl bg-gray-50 p-3">
                              <div className="font-black text-gray-900">{user.activity.favoriteExhibitions}</div>
                              <div className="mt-1 text-gray-400">展陈收藏</div>
                            </div>
                            <div className="rounded-2xl bg-gray-50 p-3">
                              <div className="font-black text-gray-900">{user.activity.exhibitions}</div>
                              <div className="mt-1 text-gray-400">总展陈</div>
                            </div>
                            <div className="rounded-2xl bg-gray-50 p-3">
                              <div className="font-black text-gray-900">{user.activity.publicExhibitions}</div>
                              <div className="mt-1 text-gray-400">公开展陈</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top text-gray-500">{formatDate(user.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
