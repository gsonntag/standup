'use client';

const IMAGE_PATTERN = /^!\[([^\]]*)\]\((\/uploads\/[^)\s]+)\)$/;
const LINK_PATTERN = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((?:https?:\/\/[^)\s]+|\/uploads\/[^)\s]+)\))/g;

function renderInline(text) {
  return text.split(LINK_PATTERN).filter(Boolean).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }

    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/uploads\/[^)\s]+)\)$/);
    if (link) {
      return (
        <a key={index} href={link[2]} target={link[2].startsWith('http') ? '_blank' : undefined} rel="noreferrer">
          {link[1]}
        </a>
      );
    }

    return part;
  });
}

export default function DescriptionPreview({ value }) {
  const lines = value.split('\n');
  const hasContent = lines.some((line) => line.trim());

  if (!hasContent) return null;

  return (
    <div className="description-preview">
      {lines.map((line, index) => {
        const trimmed = line.trim();
        const image = trimmed.match(IMAGE_PATTERN);
        if (image) {
          return (
            <img
              key={`${image[2]}-${index}`}
              className="description-image"
              src={image[2]}
              alt={image[1] || 'Uploaded description image'}
            />
          );
        }
        if (!trimmed) return <div key={index} className="description-spacer" />;
        if (trimmed.startsWith('### ')) return <h4 key={index}>{renderInline(trimmed.slice(4))}</h4>;
        if (trimmed.startsWith('## ')) return <h3 key={index}>{renderInline(trimmed.slice(3))}</h3>;
        if (trimmed.startsWith('# ')) return <h2 key={index}>{renderInline(trimmed.slice(2))}</h2>;

        const checkbox = trimmed.match(/^- \[([ xX])\] (.*)$/);
        if (checkbox) {
          return (
            <div key={index} className="description-check">
              <input type="checkbox" checked={checkbox[1].toLowerCase() === 'x'} readOnly />
              <span>{renderInline(checkbox[2])}</span>
            </div>
          );
        }

        if (trimmed.startsWith('- ')) {
          return <div key={index} className="description-bullet">{renderInline(trimmed.slice(2))}</div>;
        }

        return <p key={index}>{renderInline(trimmed)}</p>;
      })}
    </div>
  );
}
