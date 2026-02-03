import { fetchApi } from "../../lib/api";
import type {
  ApiResult,
  ChoresResponse,
  CreateChoreRequest,
  UpdateChoreRequest,
} from "../../types";

// Chores API - now using Elysia endpoints at /api/chores
const CHORES_API = "/api/chores";

export const choresApi = {
  async getChores(): Promise<ChoresResponse> {
    return fetchApi<ChoresResponse>(CHORES_API);
  },

  async createChore(
    data: CreateChoreRequest
  ): Promise<ApiResult<{ id: number }>> {
    return fetchApi<ApiResult<{ id: number }>>(CHORES_API, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async toggleChore(
    choreId: number,
    emotion?: string
  ): Promise<ApiResult<{ completed: boolean }>> {
    return fetchApi<ApiResult<{ completed: boolean }>>(
      `${CHORES_API}/${choreId}/toggle`,
      {
        method: "POST",
        body: JSON.stringify({ emotion }),
      }
    );
  },

  async updateChore(
    choreId: number,
    data: UpdateChoreRequest
  ): Promise<ApiResult<{ message: string }>> {
    return fetchApi<ApiResult<{ message: string }>>(
      `${CHORES_API}/${choreId}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      }
    );
  },

  async deleteChore(choreId: number): Promise<ApiResult<{ message: string }>> {
    return fetchApi<ApiResult<{ message: string }>>(
      `${CHORES_API}/${choreId}`,
      {
        method: "DELETE",
      }
    );
  },

  async clearAllCompleted(): Promise<
    ApiResult<{ message: string; count: number }>
  > {
    return fetchApi<ApiResult<{ message: string; count: number }>>(
      `${CHORES_API}/clear-completed`,
      {
        method: "POST",
      }
    );
  },

  async uploadImage(file: File): Promise<ApiResult<{ image_path: string }>> {
    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch(CHORES_API + "/upload-image", {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "Failed to upload image" }));
      throw new Error(error.error || "Failed to upload image");
    }

    return response.json();
  },

  getImageUrl(imagePath: string | null | undefined): string | null {
    if (!imagePath) return null;
    return `${CHORES_API}/image/${imagePath}`;
  },

  getThumbnailUrl(imagePath: string | null | undefined): string | null {
    if (!imagePath) return null;
    return `${CHORES_API}/thumbnail/${imagePath}`;
  },

  async removeRecurrence(
    choreId: number
  ): Promise<ApiResult<{ message: string }>> {
    return fetchApi<ApiResult<{ message: string }>>(
      `${CHORES_API}/${choreId}/remove-recurrence`,
      {
        method: "PUT",
      }
    );
  },

  async reorderChores(choreIds: number[]): Promise<ApiResult<{ message: string }>> {
    return fetchApi<ApiResult<{ message: string }>>(`${CHORES_API}/reorder`, {
      method: "POST",
      body: JSON.stringify({ chore_ids: choreIds }),
    });
  },
};
