namespace MainModule.Attributes;

/// <summary>Controls how IsPublic is resolved during endpoint sync.</summary>
public enum PublicMode
{
    /// <summary>Auto-detect via <c>[AllowAnonymous]</c> (default).</summary>
    Auto = 0,
    /// <summary>Force <c>is_public = true</c>.</summary>
    Public = 1,
    /// <summary>Force <c>is_public = false</c> even if <c>[AllowAnonymous]</c> is present.</summary>
    Private = 2
}

/// <summary>
/// Controls how the endpoint is recorded in the <c>permissions</c> table during startup sync.
/// Apply at class level for defaults, override at method level for specific actions.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false, Inherited = true)]
public sealed class PermissionMetaAttribute : Attribute
{
    /// <summary>
    /// Marks this endpoint as a system-level permission (hidden from admin UI).
    /// Default: <c>false</c>.
    /// </summary>
    public bool IsSystem { get; set; } = false;

    /// <summary>
    /// Controls <c>is_public</c> resolution.
    /// <c>Auto</c> (default): detect from <c>[AllowAnonymous]</c>.
    /// </summary>
    public PublicMode Public { get; set; } = PublicMode.Auto;

    /// <summary>
    /// Explicit <c>permission_code</c> value (e.g. <c>"products:read"</c>).
    /// Takes priority over <see cref="AutoGenerateCode"/>.
    /// Pattern convention: <c>[resource]:[action]</c>.
    /// </summary>
    public string? Code { get; set; } = null;

    /// <summary>
    /// When <c>true</c>, auto-generates <c>permission_code</c> from the route pattern
    /// and HTTP method if <see cref="Code"/> is not explicitly set.
    /// Convention: <c>[resource]:[verb]</c> — e.g. <c>products:list</c>, <c>products:create</c>.
    /// Default: <c>false</c> (leaves <c>permission_code</c> as <c>null</c>).
    /// </summary>
    public bool AutoGenerateCode { get; set; } = false;
}
