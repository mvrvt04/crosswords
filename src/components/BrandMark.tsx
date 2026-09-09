import styles from './BrandMark.module.css';

/** The little four-square grid used as the app icon. `size` is in pixels. */
export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <span className={styles.mark} style={{ fontSize: size }} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}
