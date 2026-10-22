import * as schemas from "../src/schemas";
test.each(Object.entries(schemas).filter(([, s]) => s instanceof z.ZodObject))(
  "%s is strict", (_name, s) => expect((s as z.ZodObject<any>)._def.unknownKeys).toBe("strict"),
);
