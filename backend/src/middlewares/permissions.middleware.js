export function requireSystemManager(
  req,
  res,
  next
) {
  const level =
    Number(
      req.user?.accessLevel || 3
    );

  if (level > 2) {
    return res.status(403).json({
      ok: false,
      message:
        "Você não possui permissão para administrar usuários do sistema.",
    });
  }

  next();
}