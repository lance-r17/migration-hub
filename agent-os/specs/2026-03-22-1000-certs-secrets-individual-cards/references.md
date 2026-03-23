# References for Certificates & Secrets Individual Cards

## Similar Implementations

### RisksBlockersSection

- **Location:** `frontend/src/components/project/RisksBlockersSection.tsx`
- **Relevance:** Uses the exact same grid + placeholder card pattern being adopted here
- **Key patterns:**
  - `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6` layout
  - Dashed border placeholder card with `Plus` icon
  - Individual `SectionCard` per item with icon, title, and content

### SectionCard

- **Location:** `frontend/src/components/shared/SectionCard.tsx`
- **Relevance:** Shared card component used throughout the project detail page
- **Key patterns:** `icon`, `title`, `iconBg`, `iconColor`, `headerRight`, `children` props
