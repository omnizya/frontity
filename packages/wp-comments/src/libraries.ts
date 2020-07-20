import { Handler } from "@frontity/wp-source/types";

/**
 * A {@link Handler} for fetching comments by post ID.
 *
 * The handler gets all comments published in the specified post and creates a
 * tree structure with comments and their replies in the data object.
 *
 * @example
 * ```js
 *   libraries.source.handlers.push({
 *     name: "comments",
 *     priority: 20,
 *     pattern: "comments/:postId(\\d+)",
 *     func: commentsHandler,
 *   })
 * ```
 *
 * @param params - Defined in {@link Handler}.
 *
 * @returns A Promise that will resolve once the comments have loaded.
 */
export const commentsHandler: Handler = async ({
  route,
  params,
  state,
  libraries,
}) => {
  const { api, populate, getTotal, getTotalPages } = libraries.source;

  // Get the post ID from `params` (it is the ID passed in the link).
  const postId = parseInt(params.postId);

  /**
   * Utility that fetches and populates pages of comments.
   *
   * @param param0 - Something.
   *
   * @returns Something.
   */
  const fetchComments = async ({ postId, page }) => {
    // Fetch the first page of 100 comments.
    const response = await api.get({
      endpoint: "comments",
      params: {
        post: postId,
        page,
        // Fetch as many comments as possible.
        per_page: 100, // eslint-disable-line @typescript-eslint/camelcase
        ...state.source.params,
        // Do not get embedded entities.
        _embed: false,
      },
    });

    // Populate response
    const populated = await populate({ response, state });

    // Return response and populated.
    return { response, populated };
  };

  // Fetch the first page of 100 comments.
  const { response, populated } = await fetchComments({ postId, page: 1 });
  let rawItems = populated;

  // Get posts and pages count.
  const total = getTotal(response, populated.length);
  const totalPages = getTotalPages(response, 1);

  // Fetch other pages if there are more than one.
  if (totalPages > 1) {
    const otherPages = await Promise.all(
      new Array(totalPages - 1)
        .fill(0)
        .map((_, i) => fetchComments({ postId, page: i }))
    );

    // Add other pages to rawItems.
    rawItems = rawItems.concat(...otherPages.map(({ populated }) => populated));
  }

  const commentsMap = {};
  const items = rawItems
    .map(({ type, id }) => (commentsMap[id] = { type, id, children: [] }))
    .reduce((root, { type, id, children }) => {
      // Get the parent ID if this comment is a reply.
      const { parent } = state.source[type][id];

      // Get proper list of comments where this comment should be added.
      const list = parent !== 0 ? commentsMap[parent].children : root;

      // Add comment to the list.
      list.push({ type, id, children });

      return root;
    }, []);

  // Add data to source.
  const currentPageData = state.source.data[route];

  Object.assign(currentPageData, {
    postId,
    items,
    total,
    totalPages,
    areComments: true,
  });
};