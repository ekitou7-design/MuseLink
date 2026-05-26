import { Bell, Menu, Search } from 'lucide-react';

export const TopNav = ({ onMenuClick, onSearchClick, onBellClick, onSubmitSearch, searchQuery, setSearchQuery }: any) => (
  <header className="bg-white sticky top-0 z-[90] px-4 py-3 flex items-center gap-3 border-b border-gray-100">
    <button onClick={onMenuClick} className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors" size={20} />
        <input
          type="text"
          placeholder="搜索文物、展陈、博物馆、用户"
          value={searchQuery}
          onFocus={onSearchClick}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-gray-100/80 border-none rounded-full py-2 pl-10 pr-10 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
        />
        <button
          type="submit"
          aria-label="搜索文物"
          className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-white hover:text-primary"
        >
          <Search size={14} />
        </button>
      </div>
    </form>
    <button onClick={onBellClick} className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors relative">
      <Bell size={24} />
      <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white" />
    </button>
  </header>
);
