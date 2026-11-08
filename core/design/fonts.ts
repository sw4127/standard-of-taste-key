/**
 * The three faces, from their published packages (Fontsource, SIL Open Font License 1.1), bundled
 * with each app so no font is fetched from another site.
 *
 * Fraunces: the variable file with its optical-size axis (9–144), roman and italic. The live site's
 * two Fraunces files are static 600 and 900 weights with no optical-size axis and no italic, so they
 * cannot set the product's voice at 500 or the person's words in italic (build log, step 1).
 */
import "@fontsource-variable/fraunces/opsz.css";
import "@fontsource-variable/fraunces/opsz-italic.css";
import "@fontsource-variable/geist/index.css";
import "@fontsource-variable/geist-mono/index.css";
