// lib-zip-minimal — bibliothèque interne (TF-1226, 02/10/2026), PAS un verbe de la forge :
// aucune entrée de self-test.mjs ne l'invoque directement, elle est IMPORTÉE par les lecteurs
// qui en ont besoin (lire-classeur-xlsx.mjs, lire-modele-pbix.mjs).
//
// POURQUOI UN LECTEUR ZIP MAISON. Option décidée D-51 (a) : .xlsx et .pbix sont tous deux des
// archives ZIP (OOXML pour l'un, conteneur Power BI pour l'autre) et aucune dépendance ZIP
// (adm-zip, yauzl, jszip…) n'était présente dans ce dépôt avant TF-1226 — vérifié (aucun
// package.json, aucun node_modules). Le mandat exclut l'option « autoriser une dépendance
// externe » : Node porte nativement `zlib.inflateRawSync` pour DEFLATE, et le format ZIP local
// (PKWARE, domaine public, documenté) ne demande rien d'autre pour les deux formats visés.
//
// CE QUE CE LECTEUR FAIT : répertoire central (seule source fiable des offsets et tailles —
// jamais les en-têtes locaux, qui peuvent porter des tailles à zéro en présence d'un descripteur
// de données), méthodes STORED (0, copie brute) et DEFLATE (8, `zlib.inflateRawSync`).
//
// CE QU'IL NE FAIT PAS, ASSUMÉ ET REFUSÉ EXPLICITEMENT (jamais une lecture fausse en silence) :
// ZIP64 (tailles/offsets 0xFFFFFFFF), chiffrement, multi-volumes, toute méthode de compression
// autre que STORED/DEFLATE — absents des .xlsx/.pbix produits par Office et Power BI Desktop,
// qui sont de petits fichiers à une seule partie.
import zlib from "node:zlib";

const SIG_EOCD = 0x06054b50;
const SIG_CDH = 0x02014b50;
const SIG_LFH = 0x04034b50;

// L'EOCD vit en fin de fichier, précédée d'un commentaire de longueur variable (0 à 65535
// octets) : on balaie depuis la FIN, jamais depuis le début — un commentaire pourrait contenir
// la même signature par accident.
function trouverEOCD(buf) {
  const min = Math.max(0, buf.length - 22 - 65535);
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === SIG_EOCD) return i;
  }
  return -1;
}

export function listerEntreesZip(buf) {
  const eocd = trouverEOCD(buf);
  if (eocd < 0) throw new Error("signature EOCD introuvable — fichier n'est pas une archive ZIP valide");
  const nbEntrees = buf.readUInt16LE(eocd + 10);
  const tailleCD = buf.readUInt32LE(eocd + 12);
  const offsetCD = buf.readUInt32LE(eocd + 16);
  if (offsetCD === 0xffffffff || tailleCD === 0xffffffff || nbEntrees === 0xffff)
    throw new Error("ZIP64 détecté — non supporté par ce lecteur minimal (inattendu pour un .xlsx/.pbix)");
  const entrees = [];
  let p = offsetCD;
  for (let i = 0; i < nbEntrees; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== SIG_CDH)
      throw new Error(`en-tête de répertoire central invalide à l'offset ${p} (entrée ${i + 1}/${nbEntrees})`);
    const methode = buf.readUInt16LE(p + 10);
    const tailleCompressee = buf.readUInt32LE(p + 20);
    const tailleNonCompressee = buf.readUInt32LE(p + 24);
    const longNom = buf.readUInt16LE(p + 28);
    const longExtra = buf.readUInt16LE(p + 30);
    const longComment = buf.readUInt16LE(p + 32);
    const offsetLocal = buf.readUInt32LE(p + 42);
    const nom = buf.toString("utf8", p + 46, p + 46 + longNom);
    entrees.push({ nom, methode, tailleCompressee, tailleNonCompressee, offsetLocal });
    p += 46 + longNom + longExtra + longComment;
  }
  return entrees;
}

function lireEntreeZip(buf, entree) {
  const p = entree.offsetLocal;
  if (buf.readUInt32LE(p) !== SIG_LFH) throw new Error(`en-tête local invalide pour ${entree.nom}`);
  const longNom = buf.readUInt16LE(p + 26);
  const longExtra = buf.readUInt16LE(p + 28);
  const debutData = p + 30 + longNom + longExtra;
  const data = buf.subarray(debutData, debutData + entree.tailleCompressee);
  if (entree.methode === 0) return Buffer.from(data); // STORED
  if (entree.methode === 8) return zlib.inflateRawSync(data); // DEFLATE
  throw new Error(`méthode de compression ${entree.methode} non supportée par ce lecteur minimal (0=stockée ou 8=deflate attendu) pour ${entree.nom}`);
}

// lireArchiveZip : point d'entrée des deux lecteurs — liste des noms, test d'existence, lecture
// décompressée d'une entrée par son nom exact (sensible à la casse, comme le format ZIP).
export function lireArchiveZip(buf) {
  const entrees = listerEntreesZip(buf);
  const index = new Map(entrees.map(e => [e.nom, e]));
  return {
    noms: entrees.map(e => e.nom),
    existe: nom => index.has(nom),
    lire: nom => {
      const e = index.get(nom);
      if (!e) throw new Error(`entrée absente de l'archive : ${nom}`);
      return lireEntreeZip(buf, e);
    },
  };
}
