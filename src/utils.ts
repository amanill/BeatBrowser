export const isPlaceholderImage = (url?: string): boolean => {
  if (!url) return true;
  const lower = url.toLowerCase();
  
  // Last.fm's default star placeholder hash
  if (lower.includes("2a96cbd8b46e442fc41c2b86b821562f") || lower.includes("818148bf682d429dc215c1705eb27b98")) {
    return true;
  }
  
  return (
    lower.includes("default") ||
    lower.includes("placeholder") ||
    lower.includes("avatar") ||
    lower === ""
  );
};

export const getInitials = (name?: string): string => {
  if (!name) return "?";
  return name.substring(0, 2).toUpperCase();
};

export const getAvatarColor = (name: string): string => {
  const colors = [
    "bg-emerald-500", "bg-teal-500", "bg-cyan-500", 
    "bg-indigo-500", "bg-violet-500", "bg-purple-500", 
    "bg-fuchsia-500", "bg-rose-500", "bg-zinc-500"
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};
