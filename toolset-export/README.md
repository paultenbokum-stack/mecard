# Toolset export

Source material for rebuilding the WordPress/Toolset site in Next.js.

## 2026-03-29-module-all

A Module Manager export of a module called "All", taken from the local copy of the site on 29 March 2026
(Types 3.4.20, Views/Blocks 3.6.9, Forms 2.6.17). It may be behind production.

| File | Contents |
| --- | --- |
| `types.xml` | 9 custom post types (MeCard Tags `t`, MeCard Profiles `mecard-profile`, More links, Companies, Contact Form Submissions, user-role, ...) |
| `taxonomies.xml` | 2 custom taxonomies |
| `groups.xml` | 12 field groups and their `wpcf-*` field definitions |
| `m2m_relationships.xml` | 8 relationships (e.g. `company-mecard-profile`, `company-mecard-tag`, `more-links`) |
| `views.xml` | 25 views, including the "Archive for Riscura Tags" WordPress archive |
| `view-templates.xml` | 39 content templates and loop items |
| `cred.xml`, `cred-user.xml` | 16 post forms and 3 user forms |
| `__module_info__` | Module manifest (serialized PHP) with item ids and checksums |

Not covered by a module export: Toolset Access settings, pages that embed views via shortcodes/blocks,
and relationship data (which post is connected to which). Those come from the database dump.
