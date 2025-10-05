export const toFriendlyDate = (date) => {
  if (!date) return '';
  return date.toLocaleString();
};

export const isToday = (date) => {
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
};

export const getTimeOnly = (date) => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

export const getRelativeDay = (date) => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  const today = new Date();

  // Check if today
  if (d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()) {
    return 'TODAY';
  }

  // Calculate days ago
  const diffTime = today - d;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 7) {
    return `${diffDays}D AGO`;
  }

  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks}W AGO`;
  }

  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months}M AGO`;
  }

  const years = Math.floor(diffDays / 365);
  return `${years}Y AGO`;
};
