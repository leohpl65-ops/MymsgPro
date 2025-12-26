// Avatar generation using uploaded images with color variations

import userImage from '@assets/images_(3)_1766773511941.jpeg';
import groupImage from '@assets/images_(2)_1766773511983.jpeg';

const USER_COLORS = [
  'hsl(199, 89%, 48%)',    // Cyan/Teal
  'hsl(0, 100%, 50%)',     // Red
  'hsl(120, 100%, 35%)',   // Green
  'hsl(44, 100%, 50%)',    // Gold
  'hsl(250, 100%, 50%)',   // Purple
  'hsl(330, 100%, 45%)',   // Pink
  'hsl(210, 100%, 50%)',   // Blue
  'hsl(40, 84%, 53%)',     // Orange
];

const GROUP_COLORS = [
  'hsl(152, 71%, 33%)',    // Dark Green
  'hsl(180, 100%, 30%)',   // Dark Cyan
  'hsl(140, 80%, 40%)',    // Emerald
  'hsl(200, 100%, 35%)',   // Dark Blue
  'hsl(160, 70%, 35%)',    // Teal
  'hsl(130, 60%, 45%)',    // Sea Green
];

export function getUserAvatar(seed: string): string {
  const hash = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colorIndex = hash % USER_COLORS.length;
  const color = USER_COLORS[colorIndex];
  
  return `url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect fill=%22${encodeURIComponent(color)}%22 width=%22100%22 height=%22100%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 font-size=%2240%22 fill=%22white%22 text-anchor=%22middle%22 dominant-baseline=%22central%22 font-family=%22Arial, sans-serif%22 font-weight=%22bold%22%3E👤%3C/text%3E%3C/svg%3E')`;
}

export function getGroupAvatar(seed: string): string {
  const hash = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colorIndex = hash % GROUP_COLORS.length;
  const color = GROUP_COLORS[colorIndex];
  
  return `url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect fill=%22${encodeURIComponent(color)}%22 width=%22100%22 height=%22100%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 font-size=%2235%22 fill=%22white%22 text-anchor=%22middle%22 dominant-baseline=%22central%22 font-family=%22Arial, sans-serif%22%3E👥%3C/text%3E%3C/svg%3E')`;
}

// Simple colored avatar generator that renders inline
export function generateUserAvatarSvg(seed: string): string {
  const hash = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const color = USER_COLORS[hash % USER_COLORS.length];
  
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Ccircle cx='50' cy='50' r='50' fill='${encodeURIComponent(color)}'/%3E%3Ccircle cx='50' cy='35' r='15' fill='white' opacity='0.9'/%3E%3Cpath d='M 30 65 Q 50 55 70 65 Q 70 75 50 75 Q 30 75 30 65' fill='white' opacity='0.9'/%3E%3C/svg%3E`;
}

export function generateGroupAvatarSvg(seed: string): string {
  const hash = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const color = GROUP_COLORS[hash % GROUP_COLORS.length];
  
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Ccircle cx='50' cy='50' r='50' fill='${encodeURIComponent(color)}'/%3E%3Ccircle cx='35' cy='32' r='10' fill='white' opacity='0.9'/%3E%3Ccircle cx='65' cy='32' r='10' fill='white' opacity='0.9'/%3E%3Cpath d='M 20 65 Q 35 55 50 55 Q 65 55 80 65 Q 80 75 50 75 Q 20 75 20 65' fill='white' opacity='0.9'/%3E%3C/svg%3E`;
}
