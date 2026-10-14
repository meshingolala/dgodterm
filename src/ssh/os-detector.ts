/**
 * DgodTerm Remote OS & Linux Flavour Detection Engine
 * Accurately detects Linux distributions and flavours from os-release / system releases.
 */

export interface DetectedOsInfo {
  flavor: string;
  name: string;
  version?: string;
  idLike?: string;
}

export function parseOsReleaseOutput(rawText: string): DetectedOsInfo | null {
  if (!rawText || typeof rawText !== 'string') return null;

  const lines = rawText.split('\n');
  const vars: Record<string, string> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim().toUpperCase();
      let val = trimmed.slice(eqIdx + 1).trim();
      // Remove surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      vars[key] = val;
    }
  }

  const id = (vars['ID'] || '').toLowerCase();
  const idLike = (vars['ID_LIKE'] || '').toLowerCase();
  const name = vars['NAME'] || vars['PRETTY_NAME'] || '';
  const prettyName = vars['PRETTY_NAME'] || vars['NAME'] || '';
  const version = vars['VERSION_ID'] || vars['VERSION'] || '';
  const allLower = (rawText + ' ' + name + ' ' + prettyName + ' ' + id).toLowerCase();

  let flavor = 'linux';

  // 1. Oracle Linux
  if (id === 'ol' || id === 'oracle' || idLike.includes('oracle') || allLower.includes('oracle linux')) {
    flavor = 'oracle';
  }
  // 2. Ubuntu
  else if (id === 'ubuntu' || allLower.includes('ubuntu')) {
    flavor = 'ubuntu';
  }
  // 3. Debian
  else if (id === 'debian' || (idLike.includes('debian') && !id.includes('ubuntu') && !id.includes('kali') && !id.includes('raspbian')) || allLower.includes('debian')) {
    flavor = 'debian';
  }
  // 4. Red Hat Enterprise Linux
  else if (id === 'rhel' || id === 'redhat' || allLower.includes('red hat enterprise linux')) {
    flavor = 'rhel';
  }
  // 5. CentOS / CentOS Stream
  else if (id === 'centos' || allLower.includes('centos')) {
    flavor = 'centos';
  }
  // 6. Rocky Linux
  else if (id === 'rocky' || allLower.includes('rocky linux')) {
    flavor = 'rocky';
  }
  // 7. AlmaLinux
  else if (id === 'almalinux' || id === 'alma' || allLower.includes('almalinux')) {
    flavor = 'almalinux';
  }
  // 8. Fedora
  else if (id === 'fedora' || allLower.includes('fedora')) {
    flavor = 'fedora';
  }
  // 9. Alpine Linux
  else if (id === 'alpine' || allLower.includes('alpine linux')) {
    flavor = 'alpine';
  }
  // 10. Arch Linux
  else if (id === 'arch' || id === 'archarm' || allLower.includes('arch linux')) {
    flavor = 'arch';
  }
  // 11. openSUSE / SLES
  else if (id.includes('suse') || id === 'sles' || allLower.includes('suse')) {
    flavor = 'opensuse';
  }
  // 12. Amazon Linux
  else if (id === 'amzn' || allLower.includes('amazon linux')) {
    flavor = 'amazon';
  }
  // 13. Kali Linux
  else if (id === 'kali' || allLower.includes('kali')) {
    flavor = 'kali';
  }
  // 14. Raspberry Pi OS / Raspbian
  else if (id === 'raspbian' || allLower.includes('raspberry pi') || allLower.includes('raspbian')) {
    flavor = 'raspbian';
  }
  // 15. Manjaro
  else if (id === 'manjaro' || allLower.includes('manjaro')) {
    flavor = 'manjaro';
  }
  // 16. Gentoo
  else if (id === 'gentoo' || allLower.includes('gentoo')) {
    flavor = 'gentoo';
  }
  // 17. NixOS
  else if (id === 'nixos' || allLower.includes('nixos')) {
    flavor = 'nixos';
  }
  // 18. Void Linux
  else if (id === 'void' || allLower.includes('void linux')) {
    flavor = 'void';
  }
  // 19. FreeBSD
  else if (allLower.includes('freebsd')) {
    flavor = 'freebsd';
  }
  // 20. Darwin / macOS
  else if (allLower.includes('darwin')) {
    flavor = 'darwin';
  }
  // Fallback check on Linux
  else if (allLower.includes('linux')) {
    flavor = 'linux';
  }

  const finalName = prettyName || name || (flavor.charAt(0).toUpperCase() + flavor.slice(1) + ' Linux');

  return {
    flavor,
    name: finalName,
    version,
    idLike
  };
}
