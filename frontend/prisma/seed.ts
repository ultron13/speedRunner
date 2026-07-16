import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create default project
  const project = await prisma.project.upsert({
    where: { id: "default-project" },
    update: {},
    create: {
      id: "default-project",
      name: "Default Project",
      description: "Default project for SpeedRunner Enterprise",
    },
  });
  console.log("Created project:", project.name);

  // Create admin user
  const passwordHash = await bcrypt.hash("admin123", 10);
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@speedrunner.dev" },
    update: {},
    create: {
      email: "admin@speedrunner.dev",
      name: "Admin User",
      passwordHash,
      role: "PLATFORM_ADMIN",
    },
  });
  console.log("Created admin user:", adminUser.email);

  // Create default SLA thresholds
  const slaThresholds = [
    { name: "Response Time SLA", metric: "AVG_RESPONSE_TIME" as const, condition: "LESS_THAN" as const, value: 500 },
    { name: "Error Rate SLA", metric: "ERROR_RATE" as const, condition: "LESS_THAN" as const, value: 5 },
    { name: "Minimum Throughput", metric: "THROUGHPUT" as const, condition: "GREATER_THAN" as const, value: 100 },
  ];

  for (const sla of slaThresholds) {
    await prisma.sLAThreshold.upsert({
      where: { id: `sla-${sla.metric}` },
      update: {},
      create: {
        id: `sla-${sla.metric}`,
        projectId: project.id,
        ...sla,
      },
    });
  }
  console.log("Created SLA thresholds");

  // Create sample tests
  const sampleTests = [
    { name: "Login Load Test", scriptType: "HTTP" as const, targetUrl: "https://example.com/login", virtualUsers: 50 },
    { name: "API Stress Test", scriptType: "HTTP" as const, targetUrl: "https://example.com/api/v1", virtualUsers: 200 },
    { name: "WebSocket Test", scriptType: "HTTP" as const, targetUrl: "wss://example.com/ws", virtualUsers: 100 },
  ];

  for (const test of sampleTests) {
    await prisma.test.upsert({
      where: { id: `test-${test.name.toLowerCase().replace(/\s/g, "-")}` },
      update: {},
      create: {
        id: `test-${test.name.toLowerCase().replace(/\s/g, "-")}`,
        projectId: project.id,
        ...test,
        description: `Sample ${test.name.toLowerCase()} for testing`,
      },
    });
  }
  console.log("Created sample tests");

  // Create sample templates
  const sampleTemplates = [
    { name: "HTTP Load Template", scriptType: "HTTP" as const, targetUrl: "https://api.example.com", virtualUsers: 100 },
    { name: "Stress Test Template", scriptType: "HTTP" as const, targetUrl: "https://api.example.com/stress", virtualUsers: 500 },
  ];

  for (const template of sampleTemplates) {
    await prisma.testTemplate.upsert({
      where: { id: `tpl-${template.name.toLowerCase().replace(/\s/g, "-")}` },
      update: {},
      create: {
        id: `tpl-${template.name.toLowerCase().replace(/\s/g, "-")}`,
        projectId: project.id,
        ...template,
        description: `Template for ${template.name.toLowerCase()}`,
      },
    });
  }
  console.log("Created sample templates");

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
