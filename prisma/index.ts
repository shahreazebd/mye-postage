import { PrismaClient } from "generated/prisma"

export const prisma = new PrismaClient()

export async function checkDbConnection() {
  try {
    // Attempt a simple query to verify connection
    await prisma.$queryRaw`SELECT 1`
    console.log("Database connected!")
    return true
  } catch (error) {
    console.error("Failed to connect to database:", error)
    return false
  }
}
