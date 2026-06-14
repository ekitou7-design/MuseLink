import React from "react";
import App from "../App";

export function HomePage({ initialTab = "explore" }: { initialTab?: string }) {
  return (
    <div className="h-full bg-gray-50">
      {/* App main content */}
      <App initialTab={initialTab} />
    </div>
  );
}
