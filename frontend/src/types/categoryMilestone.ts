export const CATEGORY_MILESTONE_COLORS = [
  '#E07A5F', // terracotta
  '#81B29A', // sage green
  '#F2CC8F', // warm mustard
  '#3D405B', // charcoal slate
  '#5E8B7E', // sea moss
  '#9D4EDD', // rich purple
  '#D4A373', // warm sand
  '#6A4C93', // deep amethyst
  '#C8553D', // burnt sienna
  '#2A9D8F', // deep jade
] as const

export interface CategoryMilestone {
  id: string
  name: string
  startDate: string       // ISO date 'yyyy-MM-dd'
  endDate: string         // ISO date 'yyyy-MM-dd'
  color?: string
  icon?: string
  createdAt: string       // ISO 8601
}
