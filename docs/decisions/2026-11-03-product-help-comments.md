# Product help and explicit chat tags

Policy: planning=compact; context_depth=dependency; verification_depth=impact; delegation=none. Scope: PartyStage product tools, ShoppingHostPanel, compact ProductActions/ProductComments, chat:send tag selection and product-aware host requests, connected tests and docs. Preserve landing/invite/party navigation/management/vote layout and end controls.

Evidence: chat:send applies party.currentProductId when productId is null, overriding No product tag. Stage mixes expanded actions/comments, and ShoppingHostPanel currently exposes only the three-question selector while existing party:host supports catalog questions/comparison.

Decision: explicit tags only; no retagging or data migration of old messages. Restore existing catalog-host question/compare within Product help, optional three-question selector collapsed. Separate small product-comment thread from description/actions. Keep Save/View visible and secondary actions under More only for the live stage. Validate optional displayed product in the room on the server, so independent browsing asks about the visible product. Reuse existing sockets, comments, save helper and styling tokens; no dependencies. User withdrew the direct end-party change; leave it unchanged.
