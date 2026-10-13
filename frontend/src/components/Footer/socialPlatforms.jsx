// Order and icons for the footer social links managed in Admin > Social Media Links.
export const SOCIAL_PLATFORMS = [
  { key: 'facebook', label: 'Facebook', icon: <i className="fa-brands fa-facebook-f"></i> },
  { key: 'instagram', label: 'Instagram', icon: <i className="fa-brands fa-instagram"></i> },
  {
    key: 'x',
    label: 'X (Twitter)',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    )
  },
  { key: 'youtube', label: 'YouTube', icon: <i className="fa-brands fa-youtube"></i> },
  { key: 'whatsapp', label: 'WhatsApp', icon: <i className="fa-brands fa-whatsapp"></i> },
  { key: 'linkedin', label: 'LinkedIn', icon: <i className="fa-brands fa-linkedin-in"></i> }
];

export const SocialIcons = ({ links, className }) => {
  const items = SOCIAL_PLATFORMS.filter(platform => links[platform.key]);
  if (!items.length) return null;

  return (
    <div className={className}>
      {items.map(item => (
        <a
          key={item.key}
          href={links[item.key]}
          aria-label={item.label}
          title={item.label}
          target="_blank"
          rel="noopener noreferrer"
        >
          {item.icon}
        </a>
      ))}
    </div>
  );
};
