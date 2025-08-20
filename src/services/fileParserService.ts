interface ParsedReference {
  title: string;
  authors: string;
  abstract?: string;
  journal?: string;
  year?: number;
  doi?: string;
  pmid?: string;
  url?: string;
}

export class FileParserService {
  static async parseFile(file: File, format: string): Promise<ParsedReference[]> {
    const text = await file.text();
    
    switch (format) {
      case 'bibtex':
        return this.parseBibTeX(text);
      case 'ris':
        return this.parseRIS(text);
      case 'endnote':
        return this.parseEndNote(text);
      case 'pubmed':
        return this.parsePubMed(text);
      case 'auto-detect':
        return this.autoDetectAndParse(text);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  private static autoDetectAndParse(text: string): ParsedReference[] {
    // Simple auto-detection based on file content patterns
    if (text.includes('@article') || text.includes('@inproceedings')) {
      return this.parseBibTeX(text);
    }
    if (text.includes('TY  -') || text.includes('AU  -')) {
      return this.parseRIS(text);
    }
    if (text.includes('PMID-') || text.includes('%A ')) {
      return this.parseEndNote(text);
    }
    // Default to treating as plain text with basic parsing
    return this.parseGeneric(text);
  }

  private static parseBibTeX(text: string): ParsedReference[] {
    const references: ParsedReference[] = [];
    const entries = text.split('@').filter(entry => entry.trim());

    entries.forEach(entry => {
      const titleMatch = entry.match(/title\s*=\s*[{"](.*?)["}]/i);
      const authorMatch = entry.match(/author\s*=\s*[{"](.*?)["}]/i);
      const journalMatch = entry.match(/journal\s*=\s*[{"](.*?)["}]/i);
      const yearMatch = entry.match(/year\s*=\s*[{"]*(\d{4})["}]*/i);
      const doiMatch = entry.match(/doi\s*=\s*[{"](.*?)["}]/i);

      if (titleMatch) {
        references.push({
          title: titleMatch[1],
          authors: authorMatch ? authorMatch[1] : '',
          journal: journalMatch ? journalMatch[1] : undefined,
          year: yearMatch ? parseInt(yearMatch[1]) : undefined,
          doi: doiMatch ? doiMatch[1] : undefined,
        });
      }
    });

    return references;
  }

  private static parseRIS(text: string): ParsedReference[] {
    const references: ParsedReference[] = [];
    const entries = text.split('ER  -').filter(entry => entry.trim());

    entries.forEach(entry => {
      const lines = entry.split('\n');
      const reference: Partial<ParsedReference> = {};

      lines.forEach(line => {
        const [tag, ...valueParts] = line.split(' - ');
        const value = valueParts.join(' - ').trim();

        switch (tag.trim()) {
          case 'TI':
            reference.title = value;
            break;
          case 'AU':
            reference.authors = reference.authors ? `${reference.authors}; ${value}` : value;
            break;
          case 'JO':
          case 'JF':
            reference.journal = value;
            break;
          case 'PY': {
            const yearMatch = value.match(/(\d{4})/);
            if (yearMatch) reference.year = parseInt(yearMatch[1]);
            break;
          }
          case 'DO':
            reference.doi = value;
            break;
          case 'AB':
            reference.abstract = value;
            break;
          case 'UR':
            reference.url = value;
            break;
        }
      });

      if (reference.title) {
        references.push(reference as ParsedReference);
      }
    });

    return references;
  }

  private static parseEndNote(text: string): ParsedReference[] {
    const references: ParsedReference[] = [];
    const entries = text.split('\n\n').filter(entry => entry.trim());

    entries.forEach(entry => {
      const lines = entry.split('\n');
      const reference: Partial<ParsedReference> = {};

      lines.forEach(line => {
        if (line.startsWith('%T ')) {
          reference.title = line.substring(3);
        } else if (line.startsWith('%A ')) {
          reference.authors = reference.authors ? `${reference.authors}; ${line.substring(3)}` : line.substring(3);
        } else if (line.startsWith('%J ')) {
          reference.journal = line.substring(3);
        } else if (line.startsWith('%D ')) {
          const year = parseInt(line.substring(3));
          if (!isNaN(year)) reference.year = year;
        } else if (line.startsWith('%X ')) {
          reference.abstract = line.substring(3);
        } else if (line.startsWith('%U ')) {
          reference.url = line.substring(3);
        }
      });

      if (reference.title) {
        references.push(reference as ParsedReference);
      }
    });

    return references;
  }

  private static parsePubMed(text: string): ParsedReference[] {
    const references: ParsedReference[] = [];
    const entries = text.split('\n\n').filter(entry => entry.trim());

    entries.forEach(entry => {
      const lines = entry.split('\n');
      const reference: Partial<ParsedReference> = {};

      lines.forEach(line => {
        if (line.startsWith('TI  - ')) {
          reference.title = line.substring(6);
        } else if (line.startsWith('AU  - ')) {
          reference.authors = reference.authors ? `${reference.authors}; ${line.substring(6)}` : line.substring(6);
        } else if (line.startsWith('SO  - ')) {
          reference.journal = line.substring(6);
        } else if (line.startsWith('DP  - ')) {
          const yearMatch = line.substring(6).match(/(\d{4})/);
          if (yearMatch) reference.year = parseInt(yearMatch[1]);
        } else if (line.startsWith('AB  - ')) {
          reference.abstract = line.substring(6);
        } else if (line.startsWith('LID - ')) {
          const doiMatch = line.substring(6).match(/([^[\s]+)/);
          if (doiMatch) reference.doi = doiMatch[1];
        } else if (line.startsWith('PMID- ')) {
          reference.pmid = line.substring(6);
        }
      });

      if (reference.title) {
        references.push(reference as ParsedReference);
      }
    });

    return references;
  }

  private static parseGeneric(text: string): ParsedReference[] {
    // Basic fallback parser for unrecognized formats
    const lines = text.split('\n').filter(line => line.trim());
    const references: ParsedReference[] = [];
    
    // Simple heuristic: assume each non-empty line might be a title
    lines.forEach((line, index) => {
      if (line.trim() && line.length > 10) {
        references.push({
          title: line.trim(),
          authors: '', // Will need manual entry
        });
      }
    });

    return references;
  }
}