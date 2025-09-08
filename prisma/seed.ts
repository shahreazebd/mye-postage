import { PrismaClient } from "generated/prisma"

import { carriers } from "./carriers"

const prisma = new PrismaClient()
async function main() {
  await prisma.carrier.createMany({ data: carriers })

  console.log("db seeded")
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
