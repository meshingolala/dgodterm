import React from 'react';
import { Server } from 'lucide-react';

export interface DistroIconProps {
  flavor?: string | null;
  className?: string;
  size?: number;
}

export const DistroIcon: React.FC<DistroIconProps> = ({
  flavor,
  className = 'w-3.5 h-3.5',
  size = 14
}) => {
  const norm = (flavor || '').toLowerCase().trim();

  // 1. Oracle Linux (Iconic Oracle Bold Red 'O' Shield)
  if (norm === 'oracle' || norm === 'ol') {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className={`shrink-0 ${className}`}
        fill="none"
        title="Oracle Linux"
      >
        <rect x="2" y="4" width="20" height="16" rx="4" fill="#C74634" />
        <circle cx="12" cy="12" r="5" stroke="#FFFFFF" strokeWidth="2.5" fill="none" />
      </svg>
    );
  }

  // 2. Ubuntu (Iconic Circle of Friends logo with 3 dots & arcs)
  if (norm === 'ubuntu') {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className={`shrink-0 ${className}`}
        fill="none"
        title="Ubuntu Linux"
      >
        <circle cx="12" cy="12" r="10" fill="#E95420" />
        {/* Three dots */}
        <circle cx="12" cy="4.5" r="1.5" fill="#FFFFFF" />
        <circle cx="5.5" cy="16" r="1.5" fill="#FFFFFF" />
        <circle cx="18.5" cy="16" r="1.5" fill="#FFFFFF" />
        {/* Connecting inner arcs */}
        <circle cx="12" cy="12" r="5.5" stroke="#FFFFFF" strokeWidth="1.6" fill="none" />
      </svg>
    );
  }

  // 3. Debian (Iconic Crimson Spiral)
  if (norm === 'debian') {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className={`shrink-0 ${className}`}
        fill="none"
        title="Debian GNU/Linux"
      >
        <circle cx="12" cy="12" r="10" fill="#D70A53" />
        <path
          d="M12 6C8.7 6 6 8.7 6 12C6 14.2 7.2 16.1 9 17.1C9.4 16.5 10 15 10 14C8.9 14 8 13.1 8 12C8 9.8 9.8 8 12 8C13.8 8 15.3 9.2 15.8 10.8C16.4 10.4 17 9.8 17.5 9.1C16.3 7.2 14.3 6 12 6Z"
          fill="#FFFFFF"
        />
        <circle cx="12" cy="12" r="1.8" fill="#FFFFFF" />
      </svg>
    );
  }

  // 4. Red Hat / RHEL (Fedora/Red Hat Hat)
  if (norm === 'rhel' || norm === 'redhat') {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className={`shrink-0 ${className}`}
        fill="none"
        title="Red Hat Enterprise Linux"
      >
        <circle cx="12" cy="12" r="10" fill="#EE0000" />
        <ellipse cx="12" cy="14" rx="7.5" ry="3.2" fill="#FFFFFF" />
        <path d="M8 14C8 10 9.5 8 12 8C14.5 8 16 10 16 14H8Z" fill="#111827" />
        <ellipse cx="12" cy="13.8" rx="4.5" ry="1.2" fill="#EE0000" />
      </svg>
    );
  }

  // 5. CentOS (Iconic 4-colour Geometric Gear Cross)
  if (norm === 'centos') {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className={`shrink-0 ${className}`}
        fill="none"
        title="CentOS Stream"
      >
        <circle cx="12" cy="12" r="10" fill="#262577" />
        <path d="M12 4L16 10H8L12 4Z" fill="#FFA000" />
        <path d="M20 12L14 16V8L20 12Z" fill="#208A3C" />
        <path d="M12 20L8 14H16L12 20Z" fill="#93227F" />
        <path d="M4 12L10 8V16L4 12Z" fill="#0096D6" />
        <circle cx="12" cy="12" r="2.5" fill="#FFFFFF" />
      </svg>
    );
  }

  // 6. Fedora (Blue Infinity 'f')
  if (norm === 'fedora') {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className={`shrink-0 ${className}`}
        fill="none"
        title="Fedora Linux"
      >
        <circle cx="12" cy="12" r="10" fill="#294172" />
        <path
          d="M15 7C13.5 7 12.5 8 12.5 9.5V11H10.5C9.5 11 9 11.5 9 12.5C9 13.5 9.5 14 10.5 14H12.5V17C12.5 18 13.2 18.5 14 18.5C14.8 18.5 15.5 18 15.5 17V14H17C17.8 14 18.5 13.5 18.5 12.5C18.5 11.5 17.8 11 17 11H15.5V9.5C15.5 9 16 8.5 16.5 8.5C17 8.5 17.5 8.8 17.5 9H19C19 7.8 17.2 7 15 7Z"
          fill="#51A2DA"
        />
        <circle cx="11.5" cy="12.5" r="1.5" fill="#FFFFFF" />
      </svg>
    );
  }

  // 7. Rocky Linux (Green Emerald Ring)
  if (norm === 'rocky') {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className={`shrink-0 ${className}`}
        fill="none"
        title="Rocky Linux"
      >
        <circle cx="12" cy="12" r="10" fill="#10B981" />
        <path d="M12 5L18 15H14L12 11L10 15H6L12 5Z" fill="#064E3B" />
        <circle cx="12" cy="14" r="3" fill="#FFFFFF" />
      </svg>
    );
  }

  // 8. AlmaLinux (Rainbow Ring / Blue Ring)
  if (norm === 'almalinux' || norm === 'alma') {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className={`shrink-0 ${className}`}
        fill="none"
        title="AlmaLinux"
      >
        <circle cx="12" cy="12" r="10" fill="#1E293B" />
        <circle cx="12" cy="12" r="6" stroke="#38BDF8" strokeWidth="2.5" fill="none" />
        <circle cx="9" cy="9" r="1.5" fill="#F43F5E" />
        <circle cx="15" cy="9" r="1.5" fill="#FBBF24" />
        <circle cx="12" cy="15" r="1.5" fill="#34D399" />
      </svg>
    );
  }

  // 9. Alpine Linux (Iconic Mountain Peaks)
  if (norm === 'alpine') {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className={`shrink-0 ${className}`}
        fill="none"
        title="Alpine Linux"
      >
        <circle cx="12" cy="12" r="10" fill="#0D597F" />
        {/* Mountain Peaks */}
        <path d="M5 16L10 8L13 13L15 10L19 16H5Z" fill="#FFFFFF" />
        <path d="M10 8L11.5 10.5L10 11.5L8.5 10.5L10 8Z" fill="#38BDF8" />
      </svg>
    );
  }

  // 10. Arch Linux (Iconic Arch Triangle)
  if (norm === 'arch') {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className={`shrink-0 ${className}`}
        fill="none"
        title="Arch Linux"
      >
        <circle cx="12" cy="12" r="10" fill="#1793D1" />
        <path
          d="M12 5L17.5 17.5L14.5 16.5L13.2 13.5C12.8 14.5 12.3 15 12 15C11.7 15 11.2 14.5 10.8 13.5L9.5 16.5L6.5 17.5L12 5Z"
          fill="#FFFFFF"
        />
      </svg>
    );
  }

  // 11. openSUSE / SLES (Green Chameleon)
  if (norm === 'opensuse' || norm === 'suse' || norm === 'sles') {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className={`shrink-0 ${className}`}
        fill="none"
        title="openSUSE Linux"
      >
        <circle cx="12" cy="12" r="10" fill="#73BA25" />
        <path
          d="M7 14C7 10 9 7 14 7C17 7 18 9 18 11C18 13 16.5 14 15 14C14 14 13.5 13.5 13.5 12.5C13.5 11.5 14 11 14.5 10.5C14.5 9.5 13.5 8.5 12 8.5C9.5 8.5 8.5 10.5 8.5 13C8.5 15.5 10.5 16.5 13 16.5C14.5 16.5 16 16 17 15"
          stroke="#FFFFFF"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="15.5" cy="10" r="1" fill="#FFFFFF" />
      </svg>
    );
  }

  // 12. Amazon Linux (AWS Orange Smile)
  if (norm === 'amazon' || norm === 'amzn') {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className={`shrink-0 ${className}`}
        fill="none"
        title="Amazon Linux"
      >
        <circle cx="12" cy="12" r="10" fill="#232F3E" />
        <path d="M6 14C9 17 15 17 18 14" stroke="#FF9900" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        <path d="M16.5 12.5L18.5 14.5L15.5 15.5" fill="#FF9900" />
      </svg>
    );
  }

  // 13. Kali Linux (Dragon Eye / Blue)
  if (norm === 'kali') {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className={`shrink-0 ${className}`}
        fill="none"
        title="Kali Linux"
      >
        <circle cx="12" cy="12" r="10" fill="#1E293B" />
        <path
          d="M7 8C9 6 13 6 15 8C17 10 18 13 17 16C16 15 15 13 14 11C12.5 14 10 16 7 16C8 14 9 12 9 10C8 9 7.5 8.5 7 8Z"
          fill="#38BDF8"
        />
      </svg>
    );
  }

  // 14. Raspberry Pi OS / Raspbian (Raspberry)
  if (norm === 'raspbian' || norm === 'raspberry') {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className={`shrink-0 ${className}`}
        fill="none"
        title="Raspberry Pi OS"
      >
        <circle cx="12" cy="12" r="10" fill="#C51A4A" />
        {/* Green leaves on top */}
        <path d="M10 6C11 4 13 4 14 6C13 7 11 7 10 6Z" fill="#6DB33F" />
        <circle cx="9.5" cy="10" r="1.5" fill="#FFFFFF" />
        <circle cx="14.5" cy="10" r="1.5" fill="#FFFFFF" />
        <circle cx="12" cy="13" r="1.8" fill="#FFFFFF" />
        <circle cx="12" cy="16.5" r="1.3" fill="#FFFFFF" />
      </svg>
    );
  }

  // 15. Manjaro (Green 3-pillars)
  if (norm === 'manjaro') {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className={`shrink-0 ${className}`}
        fill="none"
        title="Manjaro Linux"
      >
        <circle cx="12" cy="12" r="10" fill="#35BF5C" />
        <rect x="6.5" y="7" width="3.2" height="10" rx="0.8" fill="#FFFFFF" />
        <rect x="10.8" y="11" width="3.2" height="6" rx="0.8" fill="#FFFFFF" />
        <rect x="15" y="7" width="3.2" height="10" rx="0.8" fill="#FFFFFF" />
      </svg>
    );
  }

  // 16. FreeBSD
  if (norm === 'freebsd' || norm === 'bsd') {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className={`shrink-0 ${className}`}
        fill="none"
        title="FreeBSD"
      >
        <circle cx="12" cy="12" r="10" fill="#AB2B28" />
        <path d="M7 8C9 9 10 11 10 14" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M17 8C15 9 14 11 14 14" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" fill="none" />
        <ellipse cx="12" cy="14" rx="4" ry="3" fill="#FFFFFF" />
      </svg>
    );
  }

  // 17. Generic Linux / Tux Penguin
  if (norm === 'linux') {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className={`shrink-0 ${className}`}
        fill="none"
        title="Linux OS"
      >
        <circle cx="12" cy="12" r="10" fill="#1E293B" />
        {/* Tux Body */}
        <ellipse cx="12" cy="13.5" rx="5" ry="5.5" fill="#FFFFFF" />
        <ellipse cx="12" cy="8.5" rx="3.5" ry="3.5" fill="#111827" />
        <ellipse cx="12" cy="14" rx="3.2" ry="4" fill="#F8FAFC" />
        {/* Beak & Eyes */}
        <ellipse cx="10.8" cy="8" rx="0.7" ry="1" fill="#FFFFFF" />
        <ellipse cx="13.2" cy="8" rx="0.7" ry="1" fill="#FFFFFF" />
        <polygon points="11,9.5 13,9.5 12,11.5" fill="#F59E0B" />
        {/* Feet */}
        <ellipse cx="9.5" cy="18.5" rx="2" ry="1" fill="#F59E0B" />
        <ellipse cx="14.5" cy="18.5" rx="2" ry="1" fill="#F59E0B" />
      </svg>
    );
  }

  // Fallback: Generic Server
  return <Server className={className} />;
};
