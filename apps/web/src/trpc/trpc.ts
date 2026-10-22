// builders n stuff...

const t = initTRPC.context<Context>().create({
  isDev: false,
  errorFormatter({shape, error}) {
    const internal = error.code === "INTERNAL_SERVER_ERROR";
    return{
      ...shape,
      message: internal ? "Internal server error" : shape.message,
      data:{
        code: shape.data.code,
        httpStatus: shape.data.httpStatus,
        issues: error.cause instanceof ZodError
          ? error.cause.issues.map(i => ({ path: i.path, code: i.code }))
          : undefined,
        requestId: undefined,
      },
    };
  },
});

const observe = t.middleware(async ({ctx, path, type, next}) => {
  const log = ctx.log.child({route: path, type});
  const start = performance.now();
  const result = await next({ctx: { ...ctx, log }});
  if (!result.ok) {
    const err = mapError(result.error);
    (err.code === "INTERNAL_SERVER_ERROR" ? log.error : log.info)(
      { event: "request.failed", code: err.code, cause: result.error.cause ?? result.error },
    );
    throw err;
  }
  log.info({ event: "request.ok", ms: Math.round(performance.now() - start) });
  return result;
});

export const publicProcedure = t.procedure.use(observe);

export const authedProcedure = publicProcedure.use(({ctx, next}) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, user: ctx.user } });   // narrows user to non-null.
});

export const verifiedProcedure = authedProcedure.use(({ctx, next}) => {
  if (!ctx.user.emailVerifiedAt) throw new TRPCError({ code: "FORBIDDEN", message: "Verify your email first" });
  return next();
});

export const adminProcedure = authedProcedure.use(({ctx, next}) => {
  if (ctx.user.role !== "ADMIN") throw new TRPCError({ code: "FORBIDDEN" });
  return next();
});
