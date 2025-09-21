import { CompaniesRepository } from '../repositories/companiesRepository.js';
import { Company } from '../domain/types.js';

export class CompanyService {
  constructor(private readonly companiesRepository: CompaniesRepository) {}

  async list(params: {
    search?: string;
    activeOnly?: boolean;
    page?: number;
    limit?: number;
  }) {
    const limit = params.limit ?? 20;
    const page = params.page ?? 1;
    const offset = (page - 1) * limit;

    const result = await this.companiesRepository.list({
      search: params.search,
      activeOnly: params.activeOnly,
      limit,
      offset
    });

    return {
      items: result.items,
      pagination: {
        page,
        limit,
        totalItems: result.total,
        totalPages: Math.ceil(result.total / limit) || 1
      }
    };
  }

  async create(data: {
    name: string;
    urls?: string[];
    rssUrls?: string[];
    redditUrls?: string[];
    snsAccounts?: Company['snsAccounts'];
    priority?: number;
    category?: string;
    country?: string;
  }) {
    const companyId = await this.companiesRepository.create({
      name: data.name,
      urls: data.urls ?? [],
      rssUrls: data.rssUrls ?? [],
      redditUrls: data.redditUrls ?? [],
      snsAccounts: data.snsAccounts,
      priority: data.priority ?? 3,
      category: data.category,
      country: data.country,
      isActive: true
    });
    return companyId;
  }

  async update(id: string, data: Partial<Omit<Company, 'id' | 'createdAt' | 'updatedAt'>>) {
    await this.companiesRepository.update(id, data);
  }

  async deactivate(id: string) {
    await this.companiesRepository.deactivate(id);
  }

  async listActiveCompanies() {
    return this.companiesRepository.listAllActive();
  }

  async getById(id: string) {
    return this.companiesRepository.findById(id);
  }
}

