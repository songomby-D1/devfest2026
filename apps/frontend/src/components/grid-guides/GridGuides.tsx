import { cx } from '../../lib/cx';
import styles from './GridGuides.module.css';

export interface GridGuidesProps {
  theme?: 'light' | 'dark' | undefined;
  className?: string | undefined;
}

const CROSSES = ['0', '1', '2', '3'].flatMap((column) =>
  ['top', 'bottom'].map((row) => `${column}-${row}`),
);

/**
 * The landing's fixed grid: three equal columns inside the --m margins, two
 * horizontal lines at one and two thirds of the viewport, a cross at each
 * intersection. Purely decorative.
 */
export function GridGuides({ theme = 'light', className }: GridGuidesProps) {
  return (
    <div
      className={cx(styles.grid, styles[theme], className)}
      aria-hidden="true"
    >
      {CROSSES.map((key) => {
        const [column, row] = key.split('-');
        return (
          <span
            key={key}
            className={styles.cross}
            data-column={column}
            data-row={row}
          />
        );
      })}
    </div>
  );
}
