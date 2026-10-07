import type { IconDefinition } from "@fortawesome/free-solid-svg-icons";

type IconProps = {
  icon: IconDefinition;
  className?: string;
};

// Renders the same markup as FontAwesomeIcon without shipping the
// FontAwesome runtime; the matching `.svg-inline--fa` rule is in globals.css.
export default function Icon({ icon, className }: IconProps) {
  const [width, height, , , path] = icon.icon;

  return (
    <svg
      data-prefix={icon.prefix}
      data-icon={icon.iconName}
      className={`svg-inline--fa fa-${icon.iconName}${className ? ` ${className}` : ""}`}
      role="img"
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d={Array.isArray(path) ? path.join(" ") : path}
      />
    </svg>
  );
}
