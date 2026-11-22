import type { ItemDetail } from '../../lib/api';
import { KIND_LABEL } from '../../lib/content/labels';
import styles from './ItemFacts.module.css';

/** Creator, community, technique, origin, period and kind of an item; unknown values are said so. */
export function ItemFacts({ item }: { item: ItemDetail }) {
  const rows: [string, string | null][] = [
    ['Type', KIND_LABEL[item.kind]],
    ['Auteur', item.creator.name ?? item.creatorName],
    ['Communauté', item.creator.community],
    ['Technique', item.creator.technique],
    ['Origine', item.origin],
    ['Période', item.period],
  ];
  return (
    <dl className={styles.facts}>
      {rows.map(([label, value]) => (
        <div key={label} className={styles.row}>
          <dt>{label}</dt>
          <dd data-unknown={value === null ? '' : undefined}>
            {value ?? 'Non renseigné'}
          </dd>
        </div>
      ))}
    </dl>
  );
}
