interface LobbyCardProps {
  title: string;
  description: string;
  disabled?: boolean;
  markerImage?: string;
  variant?: 'solo' | 'pair' | 'private';
  children: React.ReactNode;
}

export function LobbyCard({
  title,
  description,
  disabled = false,
  markerImage,
  variant,
  children,
}: LobbyCardProps) {
  const classes = [
    'lobby-card',
    variant ? `lobby-card--${variant}` : '',
    disabled ? 'lobby-card--disabled' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <div className="lobby-card-heading">
        {markerImage && (
          <span className="lobby-card-mark" aria-hidden="true">
            <img className="lobby-card-mark-art" src={markerImage} alt="" draggable={false} />
          </span>
        )}
        <div className="lobby-card-copy">
          <h3 className="lobby-card-title">{title}</h3>
          <p className="lobby-card-desc">{description}</p>
        </div>
      </div>
      <div className="lobby-card-actions">{children}</div>
    </div>
  );
}
