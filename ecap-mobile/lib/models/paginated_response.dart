/// Khop voi PaginatedResponse va paginate() cua packages/common-dto (Technical_Spec.md muc 7):
/// { data: T[], meta: { page, limit, total } }.
class PaginatedResponse<T> {
  final List<T> data;
  final int page;
  final int limit;
  final int total;

  PaginatedResponse({
    required this.data,
    required this.page,
    required this.limit,
    required this.total,
  });

  factory PaginatedResponse.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) fromJsonT,
  ) {
    final rawData = json['data'] as List<dynamic>;
    final meta = json['meta'] as Map<String, dynamic>;
    return PaginatedResponse(
      data: rawData.map((e) => fromJsonT(e as Map<String, dynamic>)).toList(),
      page: meta['page'] as int,
      limit: meta['limit'] as int,
      total: meta['total'] as int,
    );
  }
}
