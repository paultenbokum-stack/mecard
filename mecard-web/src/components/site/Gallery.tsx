import gallery from "@/content/gallery.json";
import { imageUrl } from "@/lib/images/paths";

// The gallery page's Instagram feed (Smash Balloon), kept as the posts it
// showed at the switch-over: the plugin's API token and refresh go with WordPress.

const ICON: Record<string, string> = { video: "fa-solid fa-play", carousel: "fa-regular fa-clone" };

export function Gallery() {
  return (
    <>
      <div className="mc-gallery">
        {gallery.items.map((item) => (
          <a key={item.url} className="mc-gallery__item" href={item.url} target="_blank" rel="noopener noreferrer" title={item.caption}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl(item.image, 480) ?? item.image} alt={item.caption} loading="lazy" />
            {ICON[item.type] ? <i className={`mc-gallery__type ${ICON[item.type]}`} aria-hidden="true" /> : null}
          </a>
        ))}
      </div>
      <p className="mc-gallery__more">
        <a className="wp-block-button__link wp-element-button" href={gallery.instagram} target="_blank" rel="noopener noreferrer">
          <i className="fa-brands fa-instagram" aria-hidden="true" /> Follow on Instagram
        </a>
      </p>
    </>
  );
}
