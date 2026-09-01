import { Catalog } from "../types";

export const catalog: Catalog[] = [
  {
    title: "Trending Anime",
    filter: "/top-airing",
  },
  {
    title: "Most Popular",
    filter: "/most-popular",
  },
  {
    title: "Recently Updated",
    filter: "/recently-updated",
  },
  {
    title: "Top Upcoming",
    filter: "/top-upcoming",
  },
  {
    title: "Anime Movies",
    filter: "/movie",
  },
  {
    title: "TV Series",
    filter: "/tv",
  },
  {
    title: "Most Favorite",
    filter: "/most-favorite",
  },
  {
    title: "Completed Anime",
    filter: "/completed",
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
  { title: "Thriller", filter: "/genre/thriller" },
  { title: "Isekai", filter: "/genre/isekai" },
  { title: "Shounen", filter: "/genre/shounen" },
];
