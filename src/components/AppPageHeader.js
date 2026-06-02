'use client';

export default function AppPageHeader({ icon: Icon, title, subtitle, eyebrow, actions, meta, className = '' }) {
  return (
    <div className={`app-page-header${className ? ` ${className}` : ''}`}>
      <div className="app-page-title-row">
        {Icon && (
          <span className="app-page-icon" aria-hidden="true">
            <Icon weight="bold" />
          </span>
        )}
        <div className="app-page-copy">
          {eyebrow && <span className="app-page-eyebrow">{eyebrow}</span>}
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {(meta || actions) && (
        <div className="app-page-actions">
          {meta}
          {actions}
        </div>
      )}
    </div>
  );
}
