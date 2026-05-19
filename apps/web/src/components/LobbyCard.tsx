interface LobbyCardProps {
  title: string;
  description: string;
  disabled?: boolean;
  children: React.ReactNode;
}

export function LobbyCard({ title, description, disabled = false, children }: LobbyCardProps) {
  const classes = ['lobby-card', disabled ? 'lobby-card--disabled' : ''].filter(Boolean).join(' ');
  return (
    <div className={classes}>
      <h3 className="lobby-card-title">{title}</h3>
      <p className="lobby-card-desc">{description}</p>
      <div className="lobby-card-actions">{children}</div>
    </div>
  );
}
