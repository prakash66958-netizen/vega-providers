import { Catalog } from "../types";

export const catalog: Catalog[] = [
  {
    title: "Trending Anime",
    filter: "/filter?sort=trending",
  },
  {
    title: "Most Popular",
    filter: "/filter?sort=most_watched",
  },
  {
    title: "Recently Updated",
    filter: "/filter?sort=recently_updated",
  },
  {
    title: "Top Rated",
    filter: "/filter?sort=top_rated",
  },
  {
    title: "Most Favorited",
    filter: "/filter?sort=most_favourited",
  },
  {
    title: "Anime Movies",
    filter: "/filter?type%5B%5D=movie&sort=recently_updated",
  },
  {
    title: "TV Series",
    filter: "/filter?type%5B%5D=tv&sort=recently_updated",
  },
  {
    title: "Completed Anime",
    filter: "/filter?status%5B%5D=completed&sort=recently_updated",
  },
];

export const genres: Catalog[] = [
  { title: "Action", filter: "/genre/action" },
  { title: "Adventure", filter: "/genre/adventure" },
  { title: "Comedy", filter: "/genre/comedy" },
  { title: "Drama", filter: "/genre/drama" },
  { title: "Fantasy", filter: "/genre/fantasy" },
  { title: "Horror", filter: "/genre/horror" },
  { title: "Mystery", filter: "/genre/mystery" },
  { title: "Romance", filter: "/genre/romance" },
  { title: "Sci-Fi", filter: "/genre/sci-fi" },
  { title: "Slice of Life", filter: "/genre/slice-of-life" },
  { title: "Sports", filter: "/genre/sports" },
  { title: "Supernatural", filter: "/genre/supernatural" },
  { title: "Suspense", filter: "/genre/suspense" },
  { title: "Isekai", filter: "/genre/isekai" },
  { title: "Seinen", filter: "/genre/seinen" },
  { title: "Shounen", filter: "/genre/shounen" },
];
