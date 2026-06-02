import { Bell, Menu, Search } from 'lucide-react';

export const TopNav = ({ onMenuClick, onSearchClick, onBellClick, onSubmitSearch, searchQuery, setSearchQuery }: any) => (
  <header className="ios-title-bar sticky top-0 z-[90] flex items-center gap-3 border-b border-black/5 bg-[var(--app-bar-bg)] px-5 backdrop-blur-xl">
    <button onClick={onMenuClick} className="flex h-10 w-10 items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-gray-100">
      <Menu size={24} />
    </button>
    <form
      className="flex-1"
      onSubmit={(event) => {
        event.preventDefault();
        onSearchClick();
        onSubmitSearch();
      }}
    >
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors" size={20} />
        <input
          type="text"
          placeholder="搜索文物、展陈、博物馆、用户"
          value={searchQuery}
          onFocus={onSearchClick}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="ios-input h-11 w-full border-none py-0 pl-11 pr-11 text-[15px] outline-none transition-all focus:ring-2 focus:ring-primary/15"
        />
        <button
          type="submit"
          aria-label="搜索文物"
          className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-white hover:text-primary"
        >
          <Search size={14} />
        </button>
      </div>
    </form>
    <button onClick={onBellClick} className="relative flex h-10 w-10 items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-gray-100">
      <Bell size={24} />
      <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white" />
    </button>
  </header>
);
