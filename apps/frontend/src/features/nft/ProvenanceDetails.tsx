import type { ReactNode } from 'react';
import type { ProvenanceMint } from '../../lib/api';
import styles from './NftPanel.module.css';
import { formatDate, safeHref, shortHex } from './provenance-copy';
import { VerificationBadge } from './VerificationBadge';

export interface ProvenanceDetailsProps {
  mint: ProvenanceMint;
}

function ExternalLink({
  href,
  label,
  children,
}: {
  href: string | null;
  label: string;
  children: ReactNode;
}) {
  if (href === null) return <>{children}</>;
  return (
    <a
      className={styles.link}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label} (nouvel onglet)`}
    >
      {children}
    </a>
  );
}

function Hex({ value }: { value: string }) {
  return (
    <code className={styles.hex} title={value}>
      {shortHex(value)}
    </code>
  );
}

/** Public references of a confirmed certificate. */
export function ProvenanceDetails({ mint }: ProvenanceDetailsProps) {
  const transactionHref = safeHref(
    mint.explorer?.transaction ?? mint.explorerUrl,
  );
  const tokenHref = safeHref(mint.explorer?.token);
  const metadataHref = safeHref(mint.metadataUrl);
  const mintedAt = formatDate(mint.mintedAt ?? mint.confirmedAt);
  const owner = mint.verification?.onChain?.owner ?? null;

  return (
    <>
      <VerificationBadge verification={mint.verification} />
      <dl className={styles.details}>
        {mint.tokenId !== null && (
          <div>
            <dt>Jeton</dt>
            <dd>
              <ExternalLink
                href={tokenHref}
                label={`Jeton n° ${mint.tokenId} sur l’explorateur`}
              >
                n° {mint.tokenId}
              </ExternalLink>
            </dd>
          </div>
        )}
        {mint.transactionHash !== null && (
          <div>
            <dt>Transaction</dt>
            <dd>
              <ExternalLink
                href={transactionHref}
                label={`Transaction ${mint.transactionHash} sur l’explorateur`}
              >
                <Hex value={mint.transactionHash} />
              </ExternalLink>
            </dd>
          </div>
        )}
        {mint.network !== null && (
          <div>
            <dt>Contrat</dt>
            <dd>
              <Hex value={mint.network.contractAddress} />{' '}
              <span className={styles.muted}>
                {mint.network.name} (chaîne {mint.network.chainId})
              </span>
            </dd>
          </div>
        )}
        {mintedAt && (
          <div>
            <dt>Inscrit le</dt>
            <dd>{mintedAt}</dd>
          </div>
        )}
        {mint.tokenUri && (
          <div>
            <dt>Métadonnées (IPFS)</dt>
            <dd>
              <ExternalLink
                href={metadataHref}
                label="Métadonnées du certificat sur IPFS"
              >
                <code className={styles.hex}>{mint.tokenUri}</code>
              </ExternalLink>
            </dd>
          </div>
        )}
        {mint.masterHash && (
          <div>
            <dt>Empreinte SHA-256 de l’image originale</dt>
            <dd>
              <Hex value={mint.masterHash} />
            </dd>
          </div>
        )}
        <div>
          <dt>Détenteur</dt>
          <dd>
            Galerie LOVA (garde){' '}
            {owner && (
              <span className={styles.muted}>
                <Hex value={owner} />
              </span>
            )}
          </dd>
        </div>
      </dl>
    </>
  );
}
